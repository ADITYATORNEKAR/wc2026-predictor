import { NextRequest, NextResponse } from "next/server";
import { MATCHES } from "@/lib/matches";
import { KNOCKOUT_MATCHES } from "@/lib/knockout-matches";
import { getSheetsClient, getSheetId } from "@/lib/sheets";

const MATCHES_RANGE = "Matches!A2:H";

export async function GET(request: NextRequest) {
  const adminKey = request.nextUrl.searchParams.get("adminKey");

  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "Invalid admin key" }, { status: 401 });
  }

  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: MATCHES_RANGE,
    });

    const rows = response.data.values ?? [];

    const values = [
      ...MATCHES.map((match) => [
        match.id,
        match.homeTeam,
        match.awayTeam,
        match.group,
        match.matchDate,
        match.stage,
        "",
        "",
      ]),
      ...KNOCKOUT_MATCHES.map((match) => [
        match.id,
        match.homeTeam || match.homeTeamPlaceholder || "",
        match.awayTeam || match.awayTeamPlaceholder || "",
        match.group,
        match.matchDate,
        match.stage,
        "",
        "",
      ]),
    ];

    if (rows.length >= values.length) {
      return NextResponse.json({ skipped: true, message: "Matches sheet already seeded" });
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Matches!A2:H${values.length + 1}`,
      valueInputOption: "RAW",
      requestBody: { values },
    });

    return NextResponse.json({ seeded: values.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to seed matches" },
      { status: 500 }
    );
  }
}
