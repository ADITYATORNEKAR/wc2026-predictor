import { NextResponse } from "next/server";
import { getSheetsClient, getSheetId } from "@/lib/sheets";

export const revalidate = 300;

const MATCHES_RANGE = "Matches!A2:H";

export async function GET() {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: MATCHES_RANGE,
    });

    const rows = response.data.values ?? [];

    let matchesPlayed = 0;
    let totalGoals = 0;

    for (const row of rows) {
      const actualHome = row[6];
      const actualAway = row[7];

      if (
        actualHome !== undefined &&
        actualHome !== "" &&
        actualAway !== undefined &&
        actualAway !== ""
      ) {
        matchesPlayed++;
        totalGoals += Number(actualHome) + Number(actualAway);
      }
    }

    const goalsPerMatch = matchesPlayed > 0
      ? (totalGoals / matchesPlayed).toFixed(1)
      : "0.0";

    return NextResponse.json({ matchesPlayed, totalGoals, goalsPerMatch });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
