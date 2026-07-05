import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient, getSheetId } from "@/lib/sheets";

const PREDICTIONS_RANGE = "Predictions!A2:F";

export async function POST(request: NextRequest) {
  try {
    const matchIdsParam = request.nextUrl.searchParams.get("matchIds");
    if (!matchIdsParam) {
      return NextResponse.json({ error: "matchIds param required" }, { status: 400 });
    }
    const matchIds = new Set(
      matchIdsParam.split(",").map((id) => id.trim()).filter(Boolean)
    );

    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: PREDICTIONS_RANGE,
    });

    const rows = response.data.values ?? [];

    // Col indices: A=0 id, B=1 userName, C=2 matchId, D=3 prediction, E=4 points, F=5 submittedAt
    const pointsClearUpdates: { range: string; values: string[][] }[] = [];

    rows.forEach((row, index) => {
      const matchId = row[2] as string;
      if (!matchIds.has(matchId)) return;

      // Clear points for every prediction row belonging to these matches
      pointsClearUpdates.push({
        range: `Predictions!E${index + 2}`,
        values: [[""]],
      });
    });

    if (pointsClearUpdates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: "RAW", data: pointsClearUpdates },
      });
    }

    return NextResponse.json({
      matches: [...matchIds],
      pointsCleared: pointsClearUpdates.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove consolation points" },
      { status: 500 }
    );
  }
}
