import { NextResponse } from "next/server";
import { getSheetsClient, getSheetId } from "@/lib/sheets";
import { getTeamRank } from "@/lib/rankings";

export const revalidate = 300;

const MATCHES_RANGE = "Matches!A2:H";

function hasResult(row: string[]): boolean {
  const h = row[6];
  const a = row[7];
  return h !== undefined && h !== "" && a !== undefined && a !== "";
}

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
    let highestScoringMatch: {
      home: string;
      away: string;
      homeScore: number;
      awayScore: number;
    } | null = null;
    let highestTotal = -1;
    let biggestUpset: {
      winner: string;
      loser: string;
      winnerRank: number;
      loserRank: number;
    } | null = null;
    let biggestUpsetMargin = 0;

    for (const row of rows) {
      if (!hasResult(row)) continue;

      const homeTeam = row[1] ?? "";
      const awayTeam = row[2] ?? "";
      const homeScore = Number(row[6]);
      const awayScore = Number(row[7]);
      const matchTotal = homeScore + awayScore;

      matchesPlayed++;
      totalGoals += matchTotal;

      if (matchTotal > highestTotal) {
        highestTotal = matchTotal;
        highestScoringMatch = { home: homeTeam, away: awayTeam, homeScore, awayScore };
      }

      if (homeScore !== awayScore) {
        const winner = homeScore > awayScore ? homeTeam : awayTeam;
        const loser = homeScore > awayScore ? awayTeam : homeTeam;
        const winnerRank = getTeamRank(winner);
        const loserRank = getTeamRank(loser);

        if (winnerRank !== undefined && loserRank !== undefined) {
          const margin = winnerRank - loserRank;
          if (margin > biggestUpsetMargin) {
            biggestUpsetMargin = margin;
            biggestUpset = { winner, loser, winnerRank, loserRank };
          }
        }
      }
    }

    const goalsPerMatch = matchesPlayed > 0
      ? (totalGoals / matchesPlayed).toFixed(1)
      : "0.0";

    return NextResponse.json({
      matchesPlayed,
      totalGoals,
      goalsPerMatch,
      highestScoringMatch,
      biggestUpset,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
