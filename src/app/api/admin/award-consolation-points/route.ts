import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSheetsClient, getSheetId } from "@/lib/sheets";

const PREDICTIONS_RANGE = "Predictions!A2:F";
const SPECIAL_PREDICTIONS_RANGE = "SpecialPredictions!A2:G";

const CONSOLATION_MATCHES = ["k1", "k4"];

export async function POST(request: NextRequest) {

  const adminKey = request.nextUrl.searchParams.get("adminKey");
  if (!adminKey || adminKey !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const matchIdsParam = request.nextUrl.searchParams.get("matchIds");
    const matchIds = matchIdsParam
      ? matchIdsParam.split(",").map((id) => id.trim()).filter(Boolean)
      : CONSOLATION_MATCHES;

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

    const existingMap = new Map<string, number>();
    predRows.forEach((row, index) => {
      existingMap.set(`${row[1]}|${row[2]}`, index);
    });

    const rowsToAppend: string[][] = [];
    const pointsUpdates: { range: string; values: (string | number)[][] }[] = [];

    for (const userName of allUsers) {
      for (const matchId of matchIds) {
        const existingIndex = existingMap.get(`${userName}|${matchId}`);

        if (existingIndex !== undefined) {
          pointsUpdates.push({
            range: `Predictions!E${existingIndex + 2}`,
            values: [[3]],
          });
        } else {
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
