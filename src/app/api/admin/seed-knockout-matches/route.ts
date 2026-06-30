import { NextResponse } from "next/server";
import { KNOCKOUT_MATCHES } from "@/lib/knockout-matches";
import { getSheetsClient, getSheetId } from "@/lib/sheets";

const MATCHES_RANGE = "Matches!A2:I";

export async function POST() {
  // Auth temporarily disabled
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: MATCHES_RANGE,
    });

    const rows = response.data.values ?? [];
    const existingIds = new Set(rows.map((row) => row[0]));

    const missing = KNOCKOUT_MATCHES.filter((match) => !existingIds.has(match.id));

    if (missing.length === 0) {
      return NextResponse.json({ added: [] });
    }

    const values = missing.map((match) => [
      match.id,
      match.homeTeam || match.homeTeamPlaceholder || "",
      match.awayTeam || match.awayTeamPlaceholder || "",
      match.group,
      match.matchDate,
      match.stage,
      "",
      "",
      "",
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: MATCHES_RANGE,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });

    return NextResponse.json({ added: missing.map((m) => m.id) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to seed knockout matches" },
      { status: 500 }
    );
  }
}
