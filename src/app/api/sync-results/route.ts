import { NextResponse } from "next/server";
import { fetchAllMatches, normalizeTeamName } from "@/lib/espn";
import { MATCHES } from "@/lib/matches";
import { setMatchResult, recalculatePoints } from "@/lib/sheets";

export async function GET() {
  try {
    const espnMatches = await fetchAllMatches();

    const finishedMatches = espnMatches.filter(
      (match) =>
        match.status === "finished" && match.homeScore !== null && match.awayScore !== null
    );

    let synced = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const espnMatch of finishedMatches) {
      const match = MATCHES.find(
        (m) =>
          normalizeTeamName(m.homeTeam) === espnMatch.homeTeam &&
          normalizeTeamName(m.awayTeam) === espnMatch.awayTeam
      );

      if (!match) {
        skipped++;
        continue;
      }

      try {
        await setMatchResult(match.id, espnMatch.homeScore as number, espnMatch.awayScore as number);
        await recalculatePoints(match.id);
        synced++;
      } catch (error) {
        errors.push(
          `Failed to sync ${match.id} (${match.homeTeam} vs ${match.awayTeam}): ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    return NextResponse.json({ synced, skipped, errors });
  } catch (error) {
    return NextResponse.json(
      { synced: 0, skipped: 0, errors: [error instanceof Error ? error.message : String(error)] },
      { status: 500 }
    );
  }
}
