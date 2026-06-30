"use client";

import { useEffect, useState } from "react";
import { Match, Stage } from "@/lib/types";
import { getTeamRank } from "@/lib/rankings";
import { formatMatchDate } from "@/lib/dateUtils";
import TeamFlag from "./TeamFlag";
import ScoreDisplay from "./ScoreDisplay";

const ROUNDS: { label: string; stages: Stage[] }[] = [
  { label: "Round of 32", stages: ["R32"] },
  { label: "Round of 16", stages: ["R16"] },
  { label: "Quarter Finals", stages: ["QF"] },
  { label: "Semi Finals", stages: ["SF"] },
  { label: "Final", stages: ["Final", "3rd"] },
];

function RankBadge({ team }: { team: string }) {
  const rank = getTeamRank(team);
  if (!rank) return null;
  return <span className="text-[10px] font-normal text-white/50">#{rank}</span>;
}

function KnockoutMatchRow({ match }: { match: Match }) {
  const isRevealed = Boolean(match.homeTeam) && Boolean(match.awayTeam);
  const hasResult = match.actualHome !== undefined && match.actualAway !== undefined;

  if (!isRevealed) {
    return (
      <div className="rounded-lg border border-[#00573F]/50 bg-[#002820]/50 px-4 py-3">
        <div className="flex items-center justify-between gap-2 text-sm italic text-[#94a3b8]">
          <span>{match.homeTeamPlaceholder ?? "TBD"}</span>
          <span className="text-[#00A651]">vs</span>
          <span className="text-right">{match.awayTeamPlaceholder ?? "TBD"}</span>
        </div>
      </div>
    );
  }

  const homeWon = hasResult && (match.actualHome as number) > (match.actualAway as number);
  const awayWon = hasResult && (match.actualAway as number) > (match.actualHome as number);

  return (
    <div className="rounded-lg border border-[#00573F] bg-[#002820] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className={`flex flex-1 items-center gap-2 ${homeWon ? "font-bold text-[#FFD700]" : "text-white"}`}>
          <TeamFlag team={match.homeTeam} size={22} />
          <span className="text-sm">{match.homeTeam}</span>
          <RankBadge team={match.homeTeam} />
        </div>

        <div className="flex flex-col items-center px-2">
          {hasResult ? (
            <ScoreDisplay match={match} className="font-[family-name:var(--font-heading)] text-lg text-white" />
          ) : (
            <span className="text-xs text-[#94a3b8]">vs</span>
          )}
        </div>

        <div
          className={`flex flex-1 items-center justify-end gap-2 text-right ${
            awayWon ? "font-bold text-[#FFD700]" : "text-white"
          }`}
        >
          <RankBadge team={match.awayTeam} />
          <span className="text-sm">{match.awayTeam}</span>
          <TeamFlag team={match.awayTeam} size={22} />
        </div>
      </div>

      {!hasResult && (
        <div className="mt-2 text-center">
          <span className="text-[10px] text-[#94a3b8]">{formatMatchDate(match.matchDate)}</span>
        </div>
      )}
    </div>
  );
}

export default function KnockoutBracket() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));

  useEffect(() => {
    fetch("/api/matches")
      .then((res) => res.json())
      .then((data: Match[]) => {
        setMatches(data.filter((m) => m.stage !== "Group"));
      })
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (matches.length === 0) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      ROUNDS.forEach((round, index) => {
        const roundMatches = matches.filter((m) => round.stages.includes(m.stage));
        const hasRevealedMatch = roundMatches.some((m) => m.homeTeam && m.awayTeam);
        if (hasRevealedMatch) next.add(index);
      });
      return next;
    });
  }, [matches]);

  const toggleRound = (index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const currentRoundIndex = (() => {
    const found = ROUNDS.findIndex((round) => {
      const roundMatches = matches.filter((m) => round.stages.includes(m.stage));
      return roundMatches.some((m) => m.homeTeam && m.awayTeam && m.actualHome === undefined);
    });
    return found === -1 ? 0 : found;
  })();

  if (loading) {
    return <p className="text-center text-sm text-[#94a3b8]">⏳ Loading bracket...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {ROUNDS.map((round, index) => {
        const roundMatches = matches
          .filter((m) => round.stages.includes(m.stage))
          .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());

        const isExpanded = expanded.has(index);
        const isCurrent = index === currentRoundIndex;

        return (
          <div key={round.label} className="overflow-hidden rounded-lg border border-[#00573F]">
            <button
              onClick={() => toggleRound(index)}
              className={`flex w-full items-center justify-between px-4 py-3 text-left transition ${
                isCurrent ? "bg-[#00A651]" : "bg-[#00573F] hover:bg-[#00573F]/80"
              }`}
            >
              <span className="flex items-center gap-2 font-[family-name:var(--font-heading)] text-lg tracking-wide text-white">
                {round.label}
                {isCurrent && (
                  <span className="rounded-full bg-[#FFD700] px-2 py-0.5 text-[10px] font-bold text-[#002820]">
                    CURRENT
                  </span>
                )}
              </span>
              <span className="text-white">{isExpanded ? "▲" : "▼"}</span>
            </button>

            {isExpanded && (
              <div className="grid grid-cols-1 gap-3 bg-[#002820] p-4 md:grid-cols-2">
                {roundMatches.map((match) => (
                  <KnockoutMatchRow key={match.id} match={match} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
