import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSheetsClient, getSheetId } from "@/lib/sheets";

const PREDICTIONS_RANGE = "Predictions!A2:F";
const SPECIAL_PREDICTIONS_RANGE = "SpecialPredictions!A2:G";

const CONSOLATION_MATCHES = ["k1", "k4"];

export async function POST(request: NextRequest) {
  try {
    const matchIdsParam = request.nextUrl.searchParams.get("matchIds");
    const matchIds = matchIdsParam
      ? matchIdsParam.split(",").map((id) => id.trim()).filter(Boolean)
      : CONSOLATION_MATCHES;

    const matchIdSet = new Set(matchIds);

    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

    const [predResponse, specialResponse] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId, range: PREDICTIONS_RANGE }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: SPECIAL_PREDICTIONS_RANGE }),
    ]);

    const predRows = predResponse.data.values ?? [];
    const specialRows = specialResponse.data.values ?? [];

    const predUsers = new Set(
      predRows.map((row) => row[1] as string).filter(Boolean)
    );
    const specialUsers = new Set(
      specialRows.map((row) => row[1] as string).filter(Boolean)
    );
    const allUsers = new Set([...predUsers, ...specialUsers]);

    // Track which userName|matchId combos already have at least one prediction row
    const coveredKeys = new Set<string>();
    const pointsUpdates: { range: string; values: (string | number)[][] }[] = [];

    // Update points=3 on EVERY existing row that belongs to one of these matches
    predRows.forEach((row, index) => {
      const matchId = row[2] as string;
      const userName = row[1] as string;
      if (!matchIdSet.has(matchId)) return;

      coveredKeys.add(`${userName}|${matchId}`);
      pointsUpdates.push({
        range: `Predictions!E${index + 2}`,
        values: [[3]],
      });
    });

    // Create rows for users who have no prediction at all for these matches
    const rowsToAppend: string[][] = [];
    for (const userName of allUsers) {
      for (const matchId of matchIds) {
        if (!coveredKeys.has(`${userName}|${matchId}`)) {
          rowsToAppend.push([
            randomUUID(),
            userName,
            matchId,
            "home",
            "3",
            new Date().toISOString(),
          ]);
        }
      }
    }

    if (rowsToAppend.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: PREDICTIONS_RANGE,
        valueInputOption: "RAW",
        requestBody: { values: rowsToAppend },
      });
    }

    if (pointsUpdates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: "RAW", data: pointsUpdates },
      });
    }

    return NextResponse.json({
      awarded: allUsers.size,
      matches: matchIds,
      created: rowsToAppend.length,
      updated: pointsUpdates.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to award points",
      },
      { status: 500 }
    );
  }
}
