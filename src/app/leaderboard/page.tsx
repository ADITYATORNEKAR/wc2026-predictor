"use client";

import { useEffect, useState } from "react";
import Leaderboard from "@/components/Leaderboard";
import MatchCard from "@/components/MatchCard";
import { Match, Prediction } from "@/lib/types";

interface LeaderboardEntry {
  name: string;
  points: number;
}

const REFRESH_INTERVAL_MS = 30000;

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    const loadLeaderboard = () => {
      fetch("/api/leaderboard")
        .then((res) => res.json())
        .then(setEntries)
        .catch(() => setEntries([]));
    };

    const loadPredictions = () => {
      fetch("/api/predictions")
        .then((res) => res.json())
        .then(setPredictions)
        .catch(() => setPredictions([]));
    };

    loadLeaderboard();
    loadPredictions();

    fetch("/api/matches")
      .then((res) => res.json())
      .then(setMatches)
      .catch(() => setMatches([]));

    const interval = setInterval(() => {
      loadLeaderboard();
      loadPredictions();
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  const matchesWithResults = matches.filter(
    (match) => match.actualHome !== undefined && match.actualAway !== undefined
  );

  return (
    <div className="mx-auto max-w-5xl bg-[#003B2B] px-4 py-8">
      <h1 className="mb-2 font-[family-name:var(--font-heading)] text-4xl tracking-wide text-[#FFD700]">
        Leaderboard
      </h1>
      <p className="mb-6 text-sm text-white">
        {predictions.length} prediction{predictions.length === 1 ? "" : "s"} submitted so far
      </p>

      <Leaderboard entries={entries} />

      <h2 className="mb-4 mt-10 font-[family-name:var(--font-heading)] text-2xl tracking-wide text-white">
        Results
      </h2>

      {matchesWithResults.length === 0 ? (
        <p className="text-sm text-white">No results yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {matchesWithResults.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
}
