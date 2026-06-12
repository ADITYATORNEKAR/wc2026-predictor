"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Match, Prediction } from "@/lib/types";
import { MappedMatch } from "@/lib/espn";
import { getFlag, FLAG_MAP } from "@/lib/flags";
import { getPredictionDisplay } from "@/lib/scoring";

const EMAIL_STORAGE_KEY = "wc2026_email";
const USERNAME_STORAGE_KEY = "wc2026_username";

const TABS = ["All", "Upcoming", "Finished", "Not Predicted"] as const;
type Tab = (typeof TABS)[number];

interface Result {
  homeScore: number;
  awayScore: number;
}

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

function pointsBadge(points: number | undefined, hasResult: boolean, hasPrediction: boolean) {
  if (!hasPrediction) {
    return <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs font-semibold text-gray-300">—</span>;
  }
  if (!hasResult || points === undefined) {
    return <span className="rounded-full bg-gray-600 px-2 py-0.5 text-xs font-semibold text-gray-200">⏳ Pending</span>;
  }
  if (points === 3) {
    return <span className="rounded-full bg-[#00A651] px-2 py-0.5 text-xs font-semibold text-white">✅ 3pts</span>;
  }
  return <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">❌ 0pts</span>;
}

export default function MyPredictionsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [liveMatches, setLiveMatches] = useState<MappedMatch[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("All");
  const [ready, setReady] = useState(false);
  const [predictionsLoading, setPredictionsLoading] = useState(true);
  const [predictionsError, setPredictionsError] = useState<string | null>(null);

  useEffect(() => {
    const storedEmail = localStorage.getItem(EMAIL_STORAGE_KEY);
    const storedUserName = localStorage.getItem(USERNAME_STORAGE_KEY);

    if (!storedEmail || !storedUserName) {
      router.replace("/predict");
      return;
    }

    setUserEmail(storedEmail);
    setUserName(storedUserName);
    setReady(true);

    fetch("/api/matches")
      .then((res) => res.json())
      .then(setMatches)
      .catch(() => setMatches([]));

    fetch(`/api/predictions?userName=${encodeURIComponent(storedUserName)}`)
      .then((res) => res.json())
      .then((data) => {
        setPredictions(data);
        setPredictionsError(null);
      })
      .catch(() => {
        setPredictions([]);
        setPredictionsError("Could not load previous predictions — you can still submit new ones");
      })
      .finally(() => setPredictionsLoading(false));

    fetch("/api/livescores")
      .then((res) => res.json())
      .then((data) => setLiveMatches(data.matches ?? []))
      .catch(() => setLiveMatches([]));
  }, [router]);

  const userPredictions = useMemo(() => {
    const map = new Map<string, Prediction>();
    for (const prediction of predictions) {
      if (prediction.userName === userName) {
        map.set(prediction.matchId, prediction);
      }
    }
    return map;
  }, [predictions, userName]);

  const liveByTeams = useMemo(() => {
    const map = new Map<string, MappedMatch>();
    for (const liveMatch of liveMatches) {
      map.set(`${liveMatch.homeTeam}__${liveMatch.awayTeam}`, liveMatch);
    }
    return map;
  }, [liveMatches]);

  const enrichedMatches = useMemo(() => {
    const now = Date.now();

    return matches.map((match) => {
      const live = liveByTeams.get(`${match.homeTeam}__${match.awayTeam}`);

      let result: Result | undefined;
      if (match.actualHome !== undefined && match.actualAway !== undefined) {
        result = { homeScore: match.actualHome, awayScore: match.actualAway };
      } else if (live?.status === "finished" && live.homeScore !== null && live.awayScore !== null) {
        result = { homeScore: live.homeScore, awayScore: live.awayScore };
      }

      const isLive = live?.status === "live" || live?.status === "halftime";
      const isFinished = result !== undefined;
      const isPast = new Date(match.matchDate).getTime() <= now;

      let status: "live" | "upcoming" | "finished";
      if (isLive) status = "live";
      else if (isFinished) status = "finished";
      else status = "upcoming";

      return { match, prediction: userPredictions.get(match.id), result, status, isPast };
    });
  }, [matches, liveByTeams, userPredictions]);

  const stats = useMemo(() => {
    let totalPoints = 0;
    let correct = 0;
    let wrong = 0;
    let pending = 0;

    for (const prediction of userPredictions.values()) {
      if (prediction.points === 3) {
        totalPoints += 3;
        correct++;
      } else if (prediction.points === 0) {
        wrong++;
      } else {
        pending++;
      }
    }

    const notPredicted = enrichedMatches.filter((m) => !m.prediction).length;

    return {
      totalPoints,
      correct,
      wrong,
      pending,
      notPredicted,
    };
  }, [enrichedMatches, userPredictions]);

  const sorted = useMemo(() => {
    return [...enrichedMatches].sort((a, b) => {
      const order = { live: 0, upcoming: 1, finished: 2 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];

      const aTime = new Date(a.match.matchDate).getTime();
      const bTime = new Date(b.match.matchDate).getTime();

      if (a.status === "finished") return bTime - aTime;
      return aTime - bTime;
    });
  }, [enrichedMatches]);

  const filtered = useMemo(() => {
    switch (activeTab) {
      case "Upcoming":
        return sorted.filter((m) => m.status !== "finished");
      case "Finished":
        return sorted.filter((m) => m.status === "finished");
      case "Not Predicted":
        return sorted.filter((m) => m.status !== "finished" && !m.prediction);
      default:
        return sorted;
    }
  }, [sorted, activeTab]);

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-5xl bg-[#003B2B] px-4 py-8">
      <h1 className="font-[family-name:var(--font-heading)] text-4xl tracking-wide text-[#FFD700]">
        My Predictions
      </h1>
      <p className="mt-1 text-sm text-white">{userEmail}</p>
      <p className="mt-2 text-lg text-white">
        Welcome back, {userName}! Here are all your predictions.
      </p>

      {predictionsError && (
        <p className="mt-3 rounded-md bg-red-600/20 px-3 py-2 text-sm font-semibold text-red-400">
          {predictionsError}
        </p>
      )}

      {predictionsLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg border border-[#00573F] bg-[#002820]" />
          ))}
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-[#94a3b8]">
            {stats.correct} correct | {stats.wrong} wrong | {stats.pending} pending | {stats.notPredicted} not predicted
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-[#00573F] bg-[#002820] p-4 text-center">
              <div className="text-xs uppercase tracking-wide text-[#94a3b8]">Total Points</div>
              <div className="mt-1 text-4xl font-bold text-[#FFD700]">{stats.totalPoints}</div>
            </div>
            <div className="rounded-lg border border-[#00573F] bg-[#002820] p-4 text-center">
              <div className="text-xs uppercase tracking-wide text-[#94a3b8]">Correct</div>
              <div className="mt-1 text-4xl font-bold text-[#00A651]">{stats.correct}</div>
            </div>
            <div className="rounded-lg border border-[#00573F] bg-[#002820] p-4 text-center">
              <div className="text-xs uppercase tracking-wide text-[#94a3b8]">Pending</div>
              <div className="mt-1 text-4xl font-bold text-[#94a3b8]">{stats.pending}</div>
            </div>
          </div>
        </>
      )}

      <div className="mt-8 mb-4 flex flex-wrap gap-2 border-b border-[#00573F] pb-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab ? "bg-[#00A651] text-white" : "bg-[#002820] text-[#94a3b8] hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {predictionsLoading ? (
        <div className="mt-2 space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg border border-[#00573F] bg-[#002820]/50" />
          ))}
        </div>
      ) : (
      <div className="overflow-x-auto rounded-lg border border-[#00573F]">
        <table className="w-full text-sm text-white">
          <thead>
            <tr className="border-b border-[#00573F] bg-[#002820] text-left text-xs uppercase tracking-wide text-[#94a3b8]">
              <th className="px-3 py-2">Match</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">My Pick</th>
              <th className="px-3 py-2">Result</th>
              <th className="px-3 py-2">Points</th>
              {activeTab === "Not Predicted" && <th className="px-3 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ match, prediction, result, status }) => (
              <tr key={match.id} className="border-b border-[#00573F]/50 bg-[#002820]/50">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {status === "live" && (
                      <span className="animate-pulse rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        LIVE
                      </span>
                    )}
                    <span>
                      {match.homeTeam ? `${getFlag(match.homeTeam)} ${match.homeTeam}` : (match.homeTeamPlaceholder ?? "TBD")}
                    </span>
                    <span className="text-[#00A651]">vs</span>
                    <span>
                      {match.awayTeam ? `${getFlag(match.awayTeam)} ${match.awayTeam}` : (match.awayTeamPlaceholder ?? "TBD")}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-[#94a3b8]">{formatMatchDate(match.matchDate)}</td>
                <td className="px-3 py-2">
                  {prediction ? (
                    getPredictionDisplay(prediction.prediction, match, FLAG_MAP)
                  ) : (
                    <span className="text-gray-400">Not submitted</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {result ? (
                    <span className="font-semibold text-[#FFD700]">
                      {result.homeScore} – {result.awayScore}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2">{pointsBadge(prediction?.points, !!result, !!prediction)}</td>
                {activeTab === "Not Predicted" && (
                  <td className="px-3 py-2">
                    <Link href="/predict" className="text-sm font-semibold text-[#00A651] transition hover:text-[#00A651]/80">
                      Predict Now →
                    </Link>
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[#94a3b8]">
                  No matches to show.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
