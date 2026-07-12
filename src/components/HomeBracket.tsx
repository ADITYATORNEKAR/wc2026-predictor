"use client";

import { useEffect, useMemo, useState } from "react";
import { Match, Stage } from "@/lib/types";
import TeamFlag from "./TeamFlag";
import { formatMatchDateOnly, formatMatchTimeOnly } from "@/lib/dateUtils";

const ROUNDS: { stage: Stage; label: string }[] = [
  { stage: "R32", label: "Round of 32" },
  { stage: "R16", label: "Round of 16" },
  { stage: "QF", label: "Quarter Finals" },
  { stage: "SF", label: "Semi Finals" },
  { stage: "Final", label: "Final" },
];

const CARD_WIDTH = 216;
const CARD_HEIGHT = 88;
const ROW_GAP = 18;
const COL_GAP = 64;
const HEADER_HEIGHT = 28;

function matchNumber(id: string): number {
  const found = id.match(/\d+/);
  return found ? parseInt(found[0], 10) : 0;
}

function TeamLine({
  team,
  score,
  won,
  lost,
}: {
  team: string;
  score?: number;
  won: boolean;
  lost: boolean;
}) {
  if (!team) {
    return <div className="text-[11px] italic text-gray-400">TBD</div>;
  }

  return (
    <div
      className={`flex items-center justify-between gap-1 text-[11px] ${
        won ? "font-bold text-gray-900" : lost ? "text-gray-400" : "text-gray-700"
      }`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <TeamFlag team={team} size={14} />
        <span className="truncate">{team}</span>
      </span>
      {score !== undefined && (
        <span className="flex shrink-0 items-center gap-1 font-[family-name:var(--font-heading)]">
          {won && <span className="text-[8px] leading-none text-[#00A651]">◄</span>}
          {score}
        </span>
      )}
    </div>
  );
}

function BracketMatchCard({ match }: { match: Match }) {
  const hasResult = match.actualHome !== undefined && match.actualAway !== undefined;

  let homeWon = false;
  let awayWon = false;
  if (hasResult) {
    if (match.decidedBy === "PEN" && match.homePenalty !== undefined && match.awayPenalty !== undefined) {
      homeWon = match.homePenalty > match.awayPenalty;
      awayWon = match.awayPenalty > match.homePenalty;
    } else {
      homeWon = (match.actualHome as number) > (match.actualAway as number);
      awayWon = (match.actualAway as number) > (match.actualHome as number);
    }
  }

  const statusLabel = hasResult ? match.decidedBy ?? "FT" : formatMatchTimeOnly(match.matchDate);

  return (
    <div
      className="flex flex-col justify-between gap-1.5 rounded-lg bg-white px-2.5 py-1.5 shadow-md ring-1 ring-black/5"
      style={{ height: CARD_HEIGHT }}
    >
      <div className="flex items-center justify-between text-[9px] text-gray-400">
        <span>{formatMatchDateOnly(match.matchDate)}</span>
        <span
          className={`rounded px-1.5 py-0.5 font-semibold ${
            hasResult ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <TeamLine team={match.homeTeam} score={match.actualHome} won={homeWon} lost={hasResult && !homeWon} />
      <TeamLine team={match.awayTeam} score={match.actualAway} won={awayWon} lost={hasResult && !awayWon} />
    </div>
  );
}

export default function HomeBracket() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stages = new Set(ROUNDS.map((r) => r.stage));
    fetch("/api/matches")
      .then((res) => res.json())
      .then((data: Match[]) => setMatches(data.filter((m) => stages.has(m.stage))))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, []);

  const layout = useMemo(() => {
    const byStage = new Map<Stage, Match[]>();
    for (const round of ROUNDS) {
      byStage.set(
        round.stage,
        matches.filter((m) => m.stage === round.stage).sort((a, b) => matchNumber(a.id) - matchNumber(b.id))
      );
    }
    const counts = ROUNDS.map((r) => byStage.get(r.stage)?.length ?? 0);
    const ready = counts.every((c) => c > 0) && counts.slice(1).every((c, i) => counts[i] === c * 2);

    if (!ready) {
      return { byStage, counts, positions: [] as number[][], totalHeight: 0, ready: false };
    }

    const positions: number[][] = [];
    positions[0] = Array.from({ length: counts[0] }, (_, i) => i * (CARD_HEIGHT + ROW_GAP));
    for (let r = 1; r < counts.length; r++) {
      const prev = positions[r - 1];
      positions[r] = Array.from({ length: counts[r] }, (_, i) => {
        const centerA = prev[2 * i] + CARD_HEIGHT / 2;
        const centerB = prev[2 * i + 1] + CARD_HEIGHT / 2;
        return (centerA + centerB) / 2 - CARD_HEIGHT / 2;
      });
    }
    const totalHeight = (counts[0] - 1) * (CARD_HEIGHT + ROW_GAP) + CARD_HEIGHT;

    return { byStage, counts, positions, totalHeight, ready: true };
  }, [matches]);

  const connectors = useMemo(() => {
    if (!layout.ready) return [];
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];

    for (let r = 0; r < ROUNDS.length - 1; r++) {
      const cnt = layout.counts[r + 1];
      const xRight = r * (CARD_WIDTH + COL_GAP) + CARD_WIDTH;
      const xMid = xRight + COL_GAP / 2;
      const xNextLeft = (r + 1) * (CARD_WIDTH + COL_GAP);

      for (let i = 0; i < cnt; i++) {
        const yA = layout.positions[r][2 * i] + CARD_HEIGHT / 2 + HEADER_HEIGHT;
        const yB = layout.positions[r][2 * i + 1] + CARD_HEIGHT / 2 + HEADER_HEIGHT;
        const yNext = layout.positions[r + 1][i] + CARD_HEIGHT / 2 + HEADER_HEIGHT;

        lines.push({ x1: xRight, y1: yA, x2: xMid, y2: yA });
        lines.push({ x1: xRight, y1: yB, x2: xMid, y2: yB });
        lines.push({ x1: xMid, y1: yA, x2: xMid, y2: yB });
        lines.push({ x1: xMid, y1: yNext, x2: xNextLeft, y2: yNext });
      }
    }

    return lines;
  }, [layout]);

  if (loading) {
    return <p className="text-center text-sm text-[#94a3b8]">⏳ Loading bracket...</p>;
  }

  if (!layout.ready) {
    return <p className="text-center text-sm text-[#94a3b8]">Bracket data unavailable</p>;
  }

  const totalWidth = ROUNDS.length * (CARD_WIDTH + COL_GAP) - COL_GAP;
  const totalHeight = layout.totalHeight + HEADER_HEIGHT;

  return (
    <div className="overflow-x-auto rounded-lg bg-[#002820] p-4">
      <div className="relative" style={{ width: totalWidth, height: totalHeight, minWidth: totalWidth }}>
        <svg className="pointer-events-none absolute inset-0" width={totalWidth} height={totalHeight}>
          {connectors.map((c, i) => (
            <line key={i} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke="#4b6358" strokeWidth={1.5} />
          ))}
        </svg>

        {ROUNDS.map((round, r) => (
          <div
            key={round.stage}
            className="absolute top-0 text-center text-[11px] font-semibold uppercase tracking-wide text-[#FFD700]"
            style={{ left: r * (CARD_WIDTH + COL_GAP), width: CARD_WIDTH }}
          >
            {round.label}
          </div>
        ))}

        {ROUNDS.map((round, r) =>
          (layout.byStage.get(round.stage) ?? []).map((match, i) => (
            <div
              key={match.id}
              className="absolute"
              style={{
                left: r * (CARD_WIDTH + COL_GAP),
                top: layout.positions[r][i] + HEADER_HEIGHT,
                width: CARD_WIDTH,
              }}
            >
              <BracketMatchCard match={match} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
