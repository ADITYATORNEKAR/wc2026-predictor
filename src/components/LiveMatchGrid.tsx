"use client";

import { useEffect, useState } from "react";
import MatchCard from "@/components/MatchCard";
import { Match } from "@/lib/types";
import { MappedMatch } from "@/lib/espn";

const POLL_INTERVAL_MS = 60000;

interface LiveMatchGridProps {
  initialMatches: Match[];
}

export default function LiveMatchGrid({ initialMatches }: LiveMatchGridProps) {
  const [liveMatches, setLiveMatches] = useState<MappedMatch[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    const loadLiveScores = () => {
      fetch("/api/livescores")
        .then((res) => res.json())
        .then((data) => {
          setLiveMatches(data.matches ?? []);
          setLastUpdated(new Date());
        })
        .catch(() => {
          setLiveMatches([]);
        });
    };

    loadLiveScores();
    const interval = setInterval(loadLiveScores, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!lastUpdated) return;

    const tick = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);

    setSecondsAgo(0);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  const liveByTeams = new Map<string, MappedMatch>();
  for (const liveMatch of liveMatches) {
    liveByTeams.set(`${liveMatch.homeTeam}__${liveMatch.awayTeam}`, liveMatch);
  }

  const hasLiveMatch = liveMatches.some((m) => m.status === "live");

  return (
    <div>
      {hasLiveMatch && (
        <h3 className="mb-4 font-[family-name:var(--font-heading)] text-xl tracking-wide text-red-500">
          🔴 LIVE NOW
        </h3>
      )}

      {lastUpdated && (
        <p className="mb-4 text-xs text-[#94a3b8]">
          Last updated: {secondsAgo} second{secondsAgo === 1 ? "" : "s"} ago
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {initialMatches.map((match) => {
          const live = liveByTeams.get(`${match.homeTeam}__${match.awayTeam}`);

          return (
            <MatchCard
              key={match.id}
              match={match}
              liveStatus={live?.status}
              liveHome={live?.homeScore}
              liveAway={live?.awayScore}
              displayClock={live?.displayClock}
            />
          );
        })}
      </div>
    </div>
  );
}
