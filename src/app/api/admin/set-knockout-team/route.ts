import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient, getSheetId } from "@/lib/sheets";

const MATCHES_RANGE = "Matches!A2:H";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matchId, side, teamName, adminKey } = body ?? {};

    if (typeof adminKey !== "string" || adminKey !== process.env.ADMIN_KEY) {
      return NextResponse.json({ error: "Invalid admin key" }, { status: 401 });
    }

    if (typeof matchId !== "string" || matchId.trim() === "") {
      return NextResponse.json({ error: "matchId is required" }, { status: 400 });
    }

    if (side !== "home" && side !== "away") {
      return NextResponse.json({ error: 'side must be "home" or "away"' }, { status: 400 });
    }

    if (typeof teamName !== "string" || teamName.trim() === "") {
      return NextResponse.json({ error: "teamName is required" }, { status: 400 });
    }

    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: MATCHES_RANGE,
    });

    const rows = response.data.values ?? [];
    const rowIndex = rows.findIndex((row) => row[0] === matchId);

    if (rowIndex === -1) {
      return NextResponse.json({ error: "Match not found" }, { status: 400 });
    }

    const sheetRow = rowIndex + 2;
    const column = side === "home" ? "B" : "C";

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Matches!${column}${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[teamName.trim()]],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to set knockout team" },
      { status: 500 }
    );
  }
}
