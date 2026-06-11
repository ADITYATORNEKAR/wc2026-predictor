"use client";

import { useEffect, useMemo, useState } from "react";
import { Match, Stage } from "@/lib/types";
import { MappedMatch } from "@/lib/espn";
import { getFlag } from "@/lib/flags";

const PREDICTION_WINDOW_HOURS = 48;

const TABS: { label: string; stages: Stage[] }[] = [
  { label: "Group Stage", stages: ["Group"] },
  { label: "Round of 32", stages: ["R32"] },
  { label: "Round of 16", stages: ["R16"] },
  { label: "Quarter Finals", stages: ["QF"] },
  { label: "Semi Finals", stages: ["SF"] },
  { label: "Final", stages: ["Final", "3rd"] },
];

const STAGE_LABELS: Record<Stage, string> = {
  Group: "Group",
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter Final",
  SF: "Semi Final",
  "3rd": "3rd Place",
  Final: "Final",
};

function formatMatchDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function TeamRow({ name, placeholder }: { name: string; placeholder?: string }) {
  if (!name) {
    return (
      <span className="italic text-[#94a3b8]">{placeholder ?? "TBD"}</span>
    );
  }

  return (
    <span className="flex items-center gap-2 font-semibold text-white">
      <span className="text-xl">{getFlag(name)}</span>
      {name}
    </span>
  );
}

function PredictionBadge({ match }: { match: Match }) {
  if (match.stage === "Group") return null;

  const kickoff = new Date(match.matchDate).getTime();
  const now = Date.now();
  const hoursUntil = (kickoff - now) / (1000 * 60 * 60);

  if (hoursUntil <= 0) {
    return <span className="rounded-full bg-gray-600 px-2 py-0.5 text-[10px] font-semibold text-white">Predictions Closed</span>;
  }

  if (hoursUntil <= PREDICTION_WINDOW_HOURS) {
    return <span className="rounded-full bg-[#00A651] px-2 py-0.5 text-[10px] font-semibold text-white">Predictions Open</span>;
  }

  return (
    <span className="rounded-full bg-[#00573F] px-2 py-0.5 text-[10px] font-semibold text-[#94a3b8]">
      Predictions open in {Math.ceil(hoursUntil - PREDICTION_WINDOW_HOURS)}h
    </span>
  );
}

function MatchScore({ match, live }: { match: Match; live?: MappedMatch }) {
  if (live?.status === "live" || live?.status === "halftime") {
    return (
      <div className="text-center">
        <span className="animate-pulse rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">● LIVE</span>
        <div className="mt-1 text-2xl font-bold text-white">
          {live.homeScore} – {live.awayScore}
        </div>
      </div>
    );
  }

  if (match.actualHome !== undefined && match.actualAway !== undefined) {
    return (
      <div className="text-center font-[family-name:var(--font-heading)] text-xl tracking-wide text-[#FFD700]">
        {match.actualHome} – {match.actualAway}
      </div>
    );
  }

  if (live?.status === "finished" && live.homeScore !== null && live.awayScore !== null) {
    return (
      <div className="text-center font-[family-name:var(--font-heading)] text-xl tracking-wide text-[#FFD700]">
        FT {live.homeScore} – {live.awayScore}
      </div>
    );
  }

  return <div className="text-center text-sm text-[#94a3b8]">{formatMatchDate(match.matchDate)}</div>;
}

function MatchCardItem({ match, live }: { match: Match; live?: MappedMatch }) {
  return (
    <div className="rounded-lg border border-[#00573F] border-l-4 border-l-[#00A651] bg-[#002820] p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="rounded-full bg-[#00A651] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          {match.stage === "Group" ? `Group ${match.group}` : STAGE_LABELS[match.stage]}
        </span>
        <PredictionBadge match={match} />
      </div>

      <div className="mb-2 flex items-center justify-between text-xs text-[#94a3b8]">
        <span>{formatMatchDate(match.matchDate)}</span>
      </div>

      <div className="flex flex-col gap-2">
        <TeamRow name={match.homeTeam} placeholder={match.homeTeamPlaceholder} />
        <TeamRow name={match.awayTeam} placeholder={match.awayTeamPlaceholder} />
      </div>

      <div className="mt-3">
        <MatchScore match={match} live={live} />
      </div>
    </div>
  );
}

function FinalCard({ match, live }: { match: Match; live?: MappedMatch }) {
  return (
    <div className="rounded-xl border-2 border-[#FFD700] bg-[#002820] p-6 shadow-2xl">
      <h3 className="mb-4 text-center font-[family-name:var(--font-heading)] text-3xl tracking-widest text-[#FFD700]">
        🏆 THE FINAL
      </h3>

      <div className="mb-2 text-center text-xs text-[#94a3b8]">{formatMatchDate(match.matchDate)}</div>

      <div className="flex flex-col items-center gap-3 text-lg">
        <TeamRow name={match.homeTeam} placeholder={match.homeTeamPlaceholder} />
        <span className="text-[#00A651]">vs</span>
        <TeamRow name={match.awayTeam} placeholder={match.awayTeamPlaceholder} />
      </div>

      <div className="mt-4">
        <MatchScore match={match} live={live} />
      </div>

      <div className="mt-3 flex justify-center">
        <PredictionBadge match={match} />
      </div>
    </div>
  );
}

export default function BracketPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [liveMatches, setLiveMatches] = useState<MappedMatch[]>([]);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    fetch("/api/matches")
      .then((res) => res.json())
      .then(setMatches)
      .catch(() => setMatches([]));

    fetch("/api/livescores")
      .then((res) => res.json())
      .then((data) => setLiveMatches(data.matches ?? []))
      .catch(() => setLiveMatches([]));
  }, []);

  const liveByTeams = useMemo(() => {
    const map = new Map<string, MappedMatch>();
    for (const liveMatch of liveMatches) {
      map.set(`${liveMatch.homeTeam}__${liveMatch.awayTeam}`, liveMatch);
    }
    return map;
  }, [liveMatches]);

  const tab = TABS[activeTab];
  const tabMatches = matches
    .filter((m) => tab.stages.includes(m.stage))
    .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());

  return (
    <div className="mx-auto max-w-6xl bg-[#003B2B] px-4 py-8">
      <h1 className="mb-6 font-[family-name:var(--font-heading)] text-4xl tracking-wide text-[#FFD700]">
        Tournament Bracket
      </h1>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-[#00573F] pb-2">
        {TABS.map((t, index) => (
          <button
            key={t.label}
            onClick={() => setActiveTab(index)}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
              activeTab === index
                ? "bg-[#00A651] text-white"
                : "bg-[#002820] text-[#94a3b8] hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab.label === "Final" ? (
        <div className="flex flex-col gap-6">
          {tabMatches
            .filter((m) => m.stage === "Final")
            .map((match) => (
              <FinalCard
                key={match.id}
                match={match}
                live={liveByTeams.get(`${match.homeTeam}__${match.awayTeam}`)}
              />
            ))}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tabMatches
              .filter((m) => m.stage === "3rd")
              .map((match) => (
                <MatchCardItem
                  key={match.id}
                  match={match}
                  live={liveByTeams.get(`${match.homeTeam}__${match.awayTeam}`)}
                />
              ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tabMatches.map((match) => (
            <MatchCardItem
              key={match.id}
              match={match}
              live={liveByTeams.get(`${match.homeTeam}__${match.awayTeam}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
