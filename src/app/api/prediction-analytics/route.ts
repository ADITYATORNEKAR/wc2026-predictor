import { NextResponse } from "next/server";
import {
  getSheetsClient,
  getSheetId,
  getLeaderboard,
} from "@/lib/sheets";
import { getResult, PredictionOutcome } from "@/lib/scoring";

export const revalidate = 300;

const PREDICTIONS_RANGE = "Predictions!A2:F";
const MATCHES_RANGE = "Matches!A2:H";

interface MatchRow {
  id: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  homeScore: number;
  awayScore: number;
  result: PredictionOutcome;
}

interface PredictionRow {
  userName: string;
  matchId: string;
  prediction: PredictionOutcome;
  points: number | undefined;
}

export async function GET() {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();

    const [matchesRes, predictionsRes, leaderboard] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId, range: MATCHES_RANGE }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: PREDICTIONS_RANGE }),
      getLeaderboard(),
    ]);

    const matchRows = matchesRes.data.values ?? [];
    const predictionRows = predictionsRes.data.values ?? [];

    const completedMatches = new Map<string, MatchRow>();
    for (const row of matchRows) {
      const id = row[0] ?? "";
      const h = row[6];
      const a = row[7];
      if (!id || h === undefined || h === "" || a === undefined || a === "") continue;

      const homeScore = Number(h);
      const awayScore = Number(a);
      completedMatches.set(id, {
        id,
        homeTeam: row[1] ?? "",
        awayTeam: row[2] ?? "",
        matchDate: row[4] ?? "",
        homeScore,
        awayScore,
        result: getResult(homeScore, awayScore),
      });
    }

    const predictions: PredictionRow[] = predictionRows.map((row) => ({
      userName: row[1] ?? "",
      matchId: row[2] ?? "",
      prediction: (row[3] as PredictionOutcome) ?? "draw",
      points: row[4] === undefined || row[4] === "" ? undefined : Number(row[4]),
    }));

    const totalPredictions = predictions.length;
    const usersParticipating = new Set(predictions.map((p) => p.userName)).size;
    const matchesPredicted = new Set(predictions.map((p) => p.matchId)).size;

    const completedPredictions = predictions.filter((p) =>
      completedMatches.has(p.matchId)
    );

    let correctCount = 0;
    let homeCount = 0;
    let drawCount = 0;
    let awayCount = 0;

    for (const pred of completedPredictions) {
      const match = completedMatches.get(pred.matchId)!;
      if (pred.prediction === match.result) correctCount++;

      if (pred.prediction === "home") homeCount++;
      else if (pred.prediction === "draw") drawCount++;
      else awayCount++;
    }

    const completedTotal = completedPredictions.length;
    const overallAccuracy = completedTotal > 0
      ? ((correctCount / completedTotal) * 100).toFixed(1) + "%"
      : "0.0%";

    const outcomeDistribution = completedTotal > 0
      ? {
          home: Math.round((homeCount / completedTotal) * 100),
          draw: Math.round((drawCount / completedTotal) * 100),
          away: Math.round((awayCount / completedTotal) * 100),
        }
      : { home: 0, draw: 0, away: 0 };

    // Hardest match: completed match with lowest correct prediction %
    const matchCorrectCounts = new Map<string, { correct: number; total: number }>();
    for (const pred of completedPredictions) {
      const match = completedMatches.get(pred.matchId)!;
      const entry = matchCorrectCounts.get(pred.matchId) ?? { correct: 0, total: 0 };
      entry.total++;
      if (pred.prediction === match.result) entry.correct++;
      matchCorrectCounts.set(pred.matchId, entry);
    }

    let hardestMatch: { home: string; away: string; correctPct: number } | null = null;
    let lowestPct = 101;
    for (const [matchId, counts] of matchCorrectCounts) {
      const pct = counts.total > 0 ? (counts.correct / counts.total) * 100 : 100;
      if (pct < lowestPct) {
        lowestPct = pct;
        const match = completedMatches.get(matchId)!;
        hardestMatch = {
          home: match.homeTeam,
          away: match.awayTeam,
          correctPct: Math.round(pct),
        };
      }
    }

    // Hottest predictor: most correct picks in last 5 completed matches
    const sortedCompleted = [...completedMatches.values()].sort(
      (a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime()
    );
    const last5Ids = new Set(sortedCompleted.slice(0, 5).map((m) => m.id));

    const recentCorrectByUser = new Map<string, number>();
    for (const pred of predictions) {
      if (!last5Ids.has(pred.matchId)) continue;
      const match = completedMatches.get(pred.matchId);
      if (!match) continue;
      if (pred.prediction === match.result) {
        recentCorrectByUser.set(
          pred.userName,
          (recentCorrectByUser.get(pred.userName) ?? 0) + 1
        );
      }
    }

    let hottestPredictor: { name: string; recentCorrect: number } | null = null;
    for (const [name, count] of recentCorrectByUser) {
      if (!hottestPredictor || count > hottestPredictor.recentCorrect) {
        hottestPredictor = { name, recentCorrect: count };
      }
    }

    // Leaderboard stats
    const currentLeader = leaderboard.length > 0
      ? { name: leaderboard[0].name, points: leaderboard[0].totalPoints }
      : null;

    const pointsGap = leaderboard.length >= 2
      ? leaderboard[0].totalPoints - leaderboard[leaderboard.length - 1].totalPoints
      : 0;

    return NextResponse.json({
      totalPredictions,
      usersParticipating,
      matchesPredicted,
      overallAccuracy,
      outcomeDistribution,
      hardestMatch,
      hottestPredictor,
      currentLeader,
      pointsGap,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to compute prediction analytics",
      },
      { status: 500 }
    );
  }
}
