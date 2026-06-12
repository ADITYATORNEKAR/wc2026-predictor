import { Match } from "@/lib/types";
import { PredictionOutcome } from "@/lib/scoring";
import TeamFlag from "./TeamFlag";

interface PredictionDisplayProps {
  prediction: PredictionOutcome;
  match: Match;
  size?: number;
}

export default function PredictionDisplay({ prediction, match, size = 20 }: PredictionDisplayProps) {
  if (prediction === "draw") return <span>🤝 Draw</span>;

  const team = prediction === "home" ? match.homeTeam : match.awayTeam;
  if (!team) {
    const placeholder = prediction === "home" ? match.homeTeamPlaceholder : match.awayTeamPlaceholder;
    return <span>{placeholder ?? "TBD"}</span>;
  }

  return (
    <span className="inline-flex items-center gap-1">
      <TeamFlag team={team} size={size} /> {team}
    </span>
  );
}
