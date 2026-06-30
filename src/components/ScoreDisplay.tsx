import { Match } from "@/lib/types";

interface ScoreDisplayProps {
  match: Match;
  className?: string;
}

export default function ScoreDisplay({ match, className }: ScoreDisplayProps) {
  const { actualHome, actualAway, decidedBy, homePenalty, awayPenalty } = match;

  if (actualHome === undefined || actualAway === undefined) return null;

  return (
    <span className={className}>
      {actualHome} - {actualAway}
      {decidedBy === "AET" && <span className="ml-1 text-[#94a3b8]">(AET)</span>}
      {decidedBy === "PEN" && (
        <>
          <span className="ml-1 text-[#94a3b8]">(AET)</span>
          <span className="mx-1 text-[#94a3b8]">·</span>
          <span className="text-[#FFD700]">
            Pen {homePenalty}-{awayPenalty}
          </span>
        </>
      )}
    </span>
  );
}
