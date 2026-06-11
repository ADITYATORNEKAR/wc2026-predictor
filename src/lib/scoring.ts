export type ResultLabel = "home" | "away" | "draw";

export function getResultLabel(home: number, away: number): ResultLabel {
  if (home > away) return "home";
  if (home < away) return "away";
  return "draw";
}

export function calculatePoints(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number
): number {
  if (predictedHome === actualHome && predictedAway === actualAway) {
    return 3;
  }

  if (getResultLabel(predictedHome, predictedAway) === getResultLabel(actualHome, actualAway)) {
    return 1;
  }

  return 0;
}
