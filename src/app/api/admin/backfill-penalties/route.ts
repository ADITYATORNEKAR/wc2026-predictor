import { NextResponse } from "next/server";
import { fetchAllMatches, normalizeTeamName } from "@/lib/espn";
import { KNOCKOUT_MATCHES } from "@/lib/knockout-matches";
import { getSheetsClient, getSheetId, getMatchResultsMap } from "@/lib/sheets";

const MATCHES_RANGE = "Matches!A2:L";
const SYNC_START_DATE = "2026-06-11";
const SYNC_END_DATE = "2026-07-22";

export async function POST() {
  // Auth temporarily disabled — one-time backfill utility.
  // Migrates/fills decidedBy + penalty columns (J/K/L) for knockout matches
  // that already have a score recorded but are missing this data
  // (e.g. matches synced before this schema existed).
  try {
    const espnMatches = await fetchAllMatches(SYNC_START_DATE, SYNC_END_DATE);
    const finishedMatches = espnMatches.filter(
      (m) => m.status === "finished" && m.homeScore !== null && m.awayScore !== null
    );

    const existingResults = await getMatchResultsMap();

    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: MATCHES_RANGE });
    const rows = response.data.values ?? [];

    const updated: string[] = [];

    for (const match of KNOCKOUT_MATCHES) {
      const existing = existingResults[match.id];
      const hasResult = existing && existing.home !== "" && !Number.isNaN(Number(existing.home));
      if (!hasResult) continue;

      const espnMatch = finishedMatches.find((em) => {
        const home = normalizeTeamName(match.homeTeam);
        const away = normalizeTeamName(match.awayTeam);
        return (
          (home === em.homeTeam && away === em.awayTeam) ||
          (home === em.awayTeam && away === em.homeTeam)
        );
      });

      if (!espnMatch) continue;

      const isFlipped = normalizeTeamName(match.homeTeam) === espnMatch.awayTeam;
      const homePenalty = isFlipped ? espnMatch.awayShootout : espnMatch.homeShootout;
      const awayPenalty = isFlipped ? espnMatch.homeShootout : espnMatch.awayShootout;
      const decidedBy = espnMatch.endedType;

      const rowIndex = rows.findIndex((row) => row[0] === match.id);
      if (rowIndex === -1) continue;

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Matches!J${rowIndex + 2}:L${rowIndex + 2}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[decidedBy, decidedBy === "PEN" ? homePenalty : "", decidedBy === "PEN" ? awayPenalty : ""]],
        },
      });

      updated.push(
        `${match.id}: ${decidedBy}${decidedBy === "PEN" ? ` (${homePenalty}-${awayPenalty})` : ""}`
      );
    }

    return NextResponse.json({ updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to backfill penalty data" },
      { status: 500 }
    );
  }
}
