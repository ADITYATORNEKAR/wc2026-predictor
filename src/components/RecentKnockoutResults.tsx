"use client";

import { useEffect, useState } from "react";
import { Match } from "@/lib/types";
import { formatMatchDateShort } from "@/lib/dateUtils";
import TeamFlag from "./TeamFlag";
import ScoreDisplay from "./ScoreDisplay";

function CompactResultCard({ match }: { match: Match }) {
  return (
    <div className="rounded-lg border border-[#00573F]/50 bg-[#002820]/60 px-4 py-3 text-[#94a3b8]">
      <div className="mb-2 flex items-center justify-between text-[10px]">
        <span className="rounded-full bg-[#00573F]/60 px-2 py-0.5 font-semibold uppercase tracking-wide">
          Semi Final
        </span>
        <span>{formatMatchDateShort(match.matchDate)}</span>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex flex-1 items-center gap-2">
          <TeamFlag team={match.homeTeam} size={18} />
          <span>{match.homeTeam}</span>
        </div>
        <ScoreDisplay match={match} className="font-[family-name:var(--font-heading)] text-base" />
        <div className="flex flex-1 items-center justify-end gap-2 text-right">
          <span>{match.awayTeam}</span>
          <TeamFlag team={match.awayTeam} size={18} />
        </div>
      </div>
    </div>
  );
}

export default function RecentKnockoutResults() {
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    fetch("/api/matches")
      .then((res) => res.json())
      .then((data: Match[]) => {
        setMatches(
          data
            .filter((m) => m.stage === "SF")
            .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime())
        );
      })
      .catch(() => setMatches([]));
  }, []);

  if (matches.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {matches.map((match) => (
        <CompactResultCard key={match.id} match={match} />
      ))}
    </div>
  );
}
