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
