import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient, getSheetId } from "@/lib/sheets";

const LEAGUES_RANGE = "Leagues!A2:B";

const DEFAULT_LEAGUES = [
  "ED&A Team Vijay",
  "ED&A Team Bryce",
  "ED&A Team Paul",
  "ED&A Team Christian",
  "ED&A Team Melissa",
  "ED&A Team Rich",
  "ED&A Team Antonio",
  "ED&A Team Kristen",
  "ED&A Team Taylor",
  "ED&A Team Kyle",
  "Team ED&A",
];

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
      range: LEAGUES_RANGE,
    });

    const rows = response.data.values ?? [];

    if (rows.length > 0) {
      return NextResponse.json({ skipped: true, message: "Leagues sheet already seeded" });
    }

    const values = DEFAULT_LEAGUES.map((leagueName) => [leagueName, new Date().toISOString()]);

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Leagues!A2:B${values.length + 1}`,
      valueInputOption: "RAW",
      requestBody: { values },
    });

    return NextResponse.json({ seeded: values.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to seed leagues" },
      { status: 500 }
    );
  }
}
