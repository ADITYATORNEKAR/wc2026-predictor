import { NextResponse } from "next/server";
import { getSheetsClient, getSheetId } from "@/lib/sheets";

const SPECIAL_PREDICTIONS_RANGE = "SpecialPredictions!A2:G";

const WINNER_CORRECT_ANSWER = "Spain";
const WINNER_POINTS = 50;
const TOP_SCORER_POINTS = 30;

export async function POST() {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: SPECIAL_PREDICTIONS_RANGE,
    });

    const rows = response.data.values ?? [];

    const summary = {
      winner: { correct: 0, total: 0 },
      topScorer: { correct: 0, total: 0 },
    };

    const pointsUpdates: { range: string; values: number[][] }[] = [];

    rows.forEach((row, index) => {
      const type = row[3];
      const pick = row[4] ?? "";
      const sheetRow = index + 2;

      if (type === "wcwinner") {
        summary.winner.total += 1;
        const isCorrect = pick === WINNER_CORRECT_ANSWER;
        if (isCorrect) summary.winner.correct += 1;

        pointsUpdates.push({
          range: `SpecialPredictions!F${sheetRow}`,
          values: [[isCorrect ? WINNER_POINTS : 0]],
        });
      } else if (type === "topscorer") {
        summary.topScorer.total += 1;
        const isCorrect = pick.toLowerCase().includes("mbapp");
        if (isCorrect) summary.topScorer.correct += 1;

        pointsUpdates.push({
          range: `SpecialPredictions!F${sheetRow}`,
          values: [[isCorrect ? TOP_SCORER_POINTS : 0]],
        });
      }
    });

    if (pointsUpdates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: "RAW", data: pointsUpdates },
      });
    }

    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to award bonus points" },
      { status: 500 }
    );
  }
}
