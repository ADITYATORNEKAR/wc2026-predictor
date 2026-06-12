import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient, getSheetId } from "@/lib/sheets";

const LEAGUES_RANGE = "Leagues!A2:B";

export async function GET(request: NextRequest) {
  const adminKey = request.nextUrl.searchParams.get("adminKey");
  const name = request.nextUrl.searchParams.get("name");

  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "Invalid admin key" }, { status: 401 });
  }

  if (!name || name.trim() === "") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: LEAGUES_RANGE,
    });

    const rows = response.data.values ?? [];
    const exists = rows.some((row) => row[0] === name);

    if (exists) {
      return NextResponse.json({ skipped: true });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: LEAGUES_RANGE,
      valueInputOption: "RAW",
      requestBody: {
        values: [[name, new Date().toISOString()]],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add league" },
      { status: 500 }
    );
  }
}
