import { Match } from "./types";

export type PredictionOutcome = "home" | "draw" | "away";

export function getResult(homeScore: number, awayScore: number): PredictionOutcome {
  if (homeScore > awayScore) return "home";
  if (homeScore < awayScore) return "away";
  return "draw";
}

export function calculatePoints(
  prediction: PredictionOutcome,
  actualHome: number,
  actualAway: number
): number {
  const actual = getResult(actualHome, actualAway);
  return prediction === actual ? 3 : 0;
}

export const OUTCOME_LABELS: Record<PredictionOutcome, string> = {
  home: "Home Win",
  draw: "Draw",
  away: "Away Win",
};

export const OUTCOME_DISPLAY: Record<PredictionOutcome, string> = {
  home: "🏠 Home Win",
  draw: "🤝 Draw",
  away: "✈️ Away Win",
};

export function getPredictionDisplay(
  prediction: PredictionOutcome,
  match: Match,
  flagMap: Record<string, string>
): string {
  if (prediction === "draw") return "🤝 Draw";

  const team = prediction === "home" ? match.homeTeam : match.awayTeam;
  if (!team) {
    const placeholder = prediction === "home" ? match.homeTeamPlaceholder : match.awayTeamPlaceholder;
    return placeholder ?? "TBD";
  }

  const flag = flagMap[team] ?? "🏳️";
  return `${flag} ${team}`;
}
