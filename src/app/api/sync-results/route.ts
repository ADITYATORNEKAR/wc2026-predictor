import { NextRequest, NextResponse } from "next/server";
import { fetchAllMatches, normalizeTeamName } from "@/lib/espn";
import { MATCHES } from "@/lib/matches";
import { KNOCKOUT_MATCHES } from "@/lib/knockout-matches";
import { setMatchResult, recalculatePoints, getMatchResultsMap } from "@/lib/sheets";

const ALL_MATCHES = [...MATCHES, ...KNOCKOUT_MATCHES];

const SYNC_START_DATE = "2026-06-11";
const SYNC_END_DATE = "2026-07-22";

function isAuthorized(request: NextRequest): boolean {
  if (request.headers.get("x-vercel-cron") === "1") return true;

  const cronSecret = request.headers.get("x-cron-secret") ?? request.nextUrl.searchParams.get("cronSecret");
  if (cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) return true;

  const adminKey = request.nextUrl.searchParams.get("adminKey");
  if (adminKey && adminKey === process.env.ADMIN_KEY) return true;

  return false;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const espnMatches = await fetchAllMatches(SYNC_START_DATE, SYNC_END_DATE);

    const finishedMatches = espnMatches.filter(
      (match) =>
        match.status === "finished" && match.homeScore !== null && match.awayScore !== null
    );

    const existingResults = await getMatchResultsMap();

    let synced = 0;
    let skipped = 0;
    let alreadySynced = 0;
    const errors: string[] = [];

    for (const espnMatch of finishedMatches) {
      const match = ALL_MATCHES.find((m) => {
        const home = normalizeTeamName(m.homeTeam);
        const away = normalizeTeamName(m.awayTeam);
        return (
          (home === espnMatch.homeTeam && away === espnMatch.awayTeam) ||
          (home === espnMatch.awayTeam && away === espnMatch.homeTeam)
        );
      });

      if (!match) {
        skipped++;
        continue;
      }

      const existing = existingResults[match.id];
      if (existing && existing.home !== "" && !Number.isNaN(Number(existing.home))) {
        alreadySynced++;
        continue;
      }

      // ESPN's home/away designation may not match ours (e.g. neutral-venue
      // group matches) — map scores onto our own homeTeam/awayTeam convention
      // so existing user predictions keep their original meaning.
      const isFlipped = normalizeTeamName(match.homeTeam) === espnMatch.awayTeam;
      const homeScore = isFlipped ? espnMatch.awayScore : espnMatch.homeScore;
      const awayScore = isFlipped ? espnMatch.homeScore : espnMatch.awayScore;
      const winner: "home" | "away" | null = isFlipped
        ? espnMatch.winner === "home"
          ? "away"
          : espnMatch.winner === "away"
            ? "home"
            : null
        : espnMatch.winner;

      const homePenalty = isFlipped ? espnMatch.awayShootout : espnMatch.homeShootout;
      const awayPenalty = isFlipped ? espnMatch.homeShootout : espnMatch.awayShootout;

      try {
        const isKnockout = match.id.startsWith("k");
        await setMatchResult(
          match.id,
          homeScore as number,
          awayScore as number,
          isKnockout ? winner : undefined,
          isKnockout ? espnMatch.endedType : undefined,
          isKnockout && espnMatch.endedType === "PEN" ? (homePenalty as number) : undefined,
          isKnockout && espnMatch.endedType === "PEN" ? (awayPenalty as number) : undefined
        );
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

    return NextResponse.json({ synced, skipped, alreadySynced, errors });
  } catch (error) {
    return NextResponse.json(
      { synced: 0, skipped: 0, alreadySynced: 0, errors: [error instanceof Error ? error.message : String(error)] },
      { status: 500 }
    );
  }
}
