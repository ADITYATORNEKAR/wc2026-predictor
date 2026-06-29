"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MatchCard from "@/components/MatchCard";
import { Match, Prediction, Stage } from "@/lib/types";
import { PredictionOutcome } from "@/lib/scoring";
import { getTeamRank } from "@/lib/rankings";
import { KNOCKOUT_MATCHES } from "@/lib/knockout-matches";
import { hasMatchStarted, isWithin48Hours, timeUntilMatch, formatMatchDateShort } from "@/lib/dateUtils";
import TeamFlag from "@/components/TeamFlag";
import PredictionDisplay from "@/components/PredictionDisplay";

const PREDICTION_WINDOW_HOURS = 48;
const CONSOLATION_MATCH_IDS = new Set(["k1", "k4"]);

const TABS: { label: string; stages: Stage[] }[] = [
  { label: "Round of 32", stages: ["R32"] },
  { label: "Round of 16", stages: ["R16"] },
  { label: "Quarter Finals", stages: ["QF"] },
  { label: "Semi Finals", stages: ["SF"] },
  { label: "Final", stages: ["Final", "3rd"] },
];

function getOutcomeRank(outcome: PredictionOutcome, match: Match): number | undefined {
  if (outcome === "draw") return undefined;
  const team = outcome === "home" ? match.homeTeam : match.awayTeam;
  if (!team) return undefined;
  return getTeamRank(team);
}

interface PickCounts {
  home: number;
  draw: number;
  away: number;
  total: number;
}

function CrowdBar({ match, counts, selection }: { match: Match; counts: PickCounts; selection?: PredictionOutcome }) {
  const validTotal = counts.home + counts.away;
  if (validTotal === 0) {
    return <p className="mt-3 text-center text-xs italic text-[#94a3b8]">Be the first to predict this match!</p>;
  }

  const homePct = Math.round((counts.home / validTotal) * 100);
  const awayPct = 100 - homePct;

  const segmentClasses = (outcome: PredictionOutcome) =>
    selection === outcome ? "ring-2 ring-inset ring-white" : "";

  return (
    <div className="mt-3">
      <p className="text-center text-xs text-[#94a3b8]">
        👥 {validTotal} pick{validTotal === 1 ? "" : "s"} so far
      </p>
      <div className="mt-1 flex h-2 w-full overflow-hidden rounded-full bg-[#001a13]">
        <div className={`bg-[#00A651] ${segmentClasses("home")}`} style={{ width: `${homePct}%` }} />
        <div className={`bg-[#3b82f6] ${segmentClasses("away")}`} style={{ width: `${awayPct}%` }} />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-[#94a3b8]">
        <span className="inline-flex items-center gap-1"><TeamFlag team={match.homeTeam} size={16} /> {homePct}%</span>
        <span className="inline-flex items-center gap-1">{awayPct}% <TeamFlag team={match.awayTeam} size={16} /></span>
      </div>
    </div>
  );
}

function PredictionWindowBadge({ match }: { match: Match }) {
  if (!match.homeTeam || !match.awayTeam) {
    return (
      <span className="rounded-full bg-[#00573F] px-2 py-0.5 text-[10px] font-semibold text-[#94a3b8]">
        Predictions open 48hrs before kickoff
      </span>
    );
  }

  if (hasMatchStarted(match.matchDate)) {
    return <span className="rounded-full bg-gray-600 px-2 py-0.5 text-[10px] font-semibold text-white">Predictions Closed</span>;
  }

  if (match.stage === "R32" || isWithin48Hours(match.matchDate)) {
    return <span className="rounded-full bg-[#00A651] px-2 py-0.5 text-[10px] font-semibold text-white">Predictions Open</span>;
  }

  const windowOpenIso = new Date(
    new Date(match.matchDate).getTime() - PREDICTION_WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString();

  return (
    <span className="rounded-full bg-[#00573F] px-2 py-0.5 text-[10px] font-semibold text-[#94a3b8]">
      Predictions open in {timeUntilMatch(windowOpenIso)}
    </span>
  );
}

const EMAIL_STORAGE_KEY = "wc2026_email";

export default function PredictKnockoutsPage() {
  const [userEmail, setUserEmail] = useState("");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [allPredictions, setAllPredictions] = useState<Prediction[]>([]);
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [lockedMatchIds, setLockedMatchIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [predictionsLoading, setPredictionsLoading] = useState(true);
  const [predictionsError, setPredictionsError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const storedEmail = localStorage.getItem(EMAIL_STORAGE_KEY);
    if (storedEmail) setUserEmail(storedEmail);

    const resolvedUserName = storedEmail ? storedEmail.split("@")[0] : "";

    fetch(`/api/predictions?userName=${encodeURIComponent(resolvedUserName)}`)
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

    fetch("/api/predictions")
      .then((res) => res.json())
      .then(setAllPredictions)
      .catch(() => setAllPredictions([]));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const userName = useMemo(() => userEmail.split("@")[0], [userEmail]);

  const userPredictions = useMemo(() => {
    const map = new Map<string, Prediction>();
    for (const prediction of predictions) {
      if (prediction.userName === userName) {
        map.set(prediction.matchId, prediction);
      }
    }
    return map;
  }, [predictions, userName]);

  const pickCountsByMatch = useMemo(() => {
    const map = new Map<string, PickCounts>();
    for (const prediction of allPredictions) {
      const current = map.get(prediction.matchId) ?? { home: 0, draw: 0, away: 0, total: 0 };
      current[prediction.prediction]++;
      current.total++;
      map.set(prediction.matchId, current);
    }
    return map;
  }, [allPredictions]);

  const handleSelect = async (matchId: string, outcome: PredictionOutcome) => {
    setErrors((prev) => ({ ...prev, [matchId]: "" }));
    setSavingMatchId(matchId);

    try {
      const response = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName,
          userEmail,
          matchId,
          prediction: outcome,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (typeof data.error === "string" && data.error.toLowerCase().includes("started")) {
          setToast("🔒 Predictions closed for this match");
          setLockedMatchIds((prev) => new Set(prev).add(matchId));

          const refreshed = await fetch(`/api/predictions?userName=${encodeURIComponent(userName)}`);
          setPredictions(await refreshed.json());
        } else {
          setErrors((prev) => ({ ...prev, [matchId]: data.error ?? "Failed to save prediction" }));
        }
        return;
      }

      const submittedAt = new Date().toISOString();
      const existing = userPredictions.get(matchId);
      const updatedPrediction: Prediction = {
        id: existing?.id ?? matchId,
        userName,
        matchId,
        prediction: outcome,
        submittedAt,
      };

      setPredictions((prev) => [
        ...prev.filter((p) => !(p.userName === userName && p.matchId === matchId)),
        updatedPrediction,
      ]);

      setAllPredictions((prev) => [
        ...prev.filter((p) => !(p.userName === userName && p.matchId === matchId)),
        updatedPrediction,
      ]);

      setToast(data.action === "updated" ? "✏️ Pick changed!" : "⚽ Pick saved!");
    } catch {
      setErrors((prev) => ({ ...prev, [matchId]: "Failed to save prediction" }));
    } finally {
      setSavingMatchId(null);
    }
  };

  const tab = TABS[activeTab];
  const tabMatches = KNOCKOUT_MATCHES
    .filter((m) => tab.stages.includes(m.stage))
    .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());

  return (
    <div className="mx-auto max-w-5xl bg-[#003B2B] px-4 py-8">
      <h1 className="mb-6 font-[family-name:var(--font-heading)] text-4xl tracking-wide text-[#FFD700]">
        ⚔️ PREDICT KNOCKOUTS
      </h1>

      <p className="mb-2 text-sm text-[#94a3b8]">Predicting as: {userEmail}</p>
      <Link href="/my-predictions" className="mb-6 inline-block text-sm text-[#00A651] transition hover:text-[#00A651]/80">
        View all my predictions →
      </Link>

      <div className="mb-6 rounded-lg border border-[#00A651] bg-[#002820] p-4 text-center text-sm text-white">
        ⏳ Knockout predictions unlock 48 hours before each match kickoff
      </div>

      {activeTab === 0 && (
        <div className="mb-6 rounded-lg border border-[#2d6a4f] bg-[#1b4332] px-4 py-3 text-center text-sm font-semibold text-[#FFD700]">
          🏆 Round of 32 has begun! Make your picks before each match kicks off.
        </div>
      )}

      {predictionsLoading && (
        <p className="mb-6 text-sm text-[#94a3b8]">⏳ Loading your predictions...</p>
      )}

      {predictionsError && (
        <p className="mb-6 rounded-md bg-red-600/20 px-3 py-2 text-sm font-semibold text-red-400">
          {predictionsError}
        </p>
      )}

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {tabMatches.map((match) => {
          const isUnrevealed = !match.homeTeam || !match.awayTeam;
          const isR32 = match.stage === "R32";
          const isConsolation = CONSOLATION_MATCH_IDS.has(match.id);
          const started = hasMatchStarted(match.matchDate);
          const isPast = started || lockedMatchIds.has(match.id);
          const isWithinWindow = isWithin48Hours(match.matchDate);
          const predictionsOpen = !isUnrevealed && !isPast && (isR32 || isWithinWindow);

          const rawPrediction = userPredictions.get(match.id);
          const existingPrediction = rawPrediction?.prediction === "draw" ? undefined : rawPrediction;
          const selection = existingPrediction?.prediction;
          const isSaving = savingMatchId === match.id;

          const showLockedState = isPast && !isUnrevealed;
          const hasResult = existingPrediction?.points !== undefined;

          return (
            <div key={match.id} className="flex flex-col gap-3">
              <MatchCard match={match} userPrediction={existingPrediction} />

              <div className="rounded-lg border border-[#00573F] bg-[#002820] p-4">
                <div className="mb-3 flex justify-center">
                  <PredictionWindowBadge match={match} />
                </div>

                {showLockedState ? (
                  isConsolation ? (
                    <p className="text-center text-sm font-semibold text-[#FFD700]">
                      ⭐ +3 pts awarded
                    </p>
                  ) : existingPrediction && hasResult ? (
                    <div className="text-center">
                      <p className="text-[#94a3b8]">
                        Your pick: <PredictionDisplay prediction={existingPrediction.prediction} match={match} size={20} />
                      </p>
                      <p className={`mt-1 text-sm font-semibold ${existingPrediction.points! > 0 ? "text-[#00A651]" : "text-red-400"}`}>
                        {existingPrediction.points! > 0 ? `✅ +${existingPrediction.points} pts` : "❌ 0 pts"}
                      </p>
                    </div>
                  ) : existingPrediction ? (
                    <div className="text-center">
                      <p className="text-[#94a3b8]">
                        Your pick: <PredictionDisplay prediction={existingPrediction.prediction} match={match} size={20} />
                      </p>
                      <p className="mt-1 text-sm font-semibold text-orange-400">
                        ⏳ Match in progress — predictions locked
                      </p>
                    </div>
                  ) : (
                    <p className="rounded-md bg-red-600/20 px-3 py-2 text-center text-sm font-semibold text-red-400">
                      🔒 Predictions Closed — You did not make a prediction
                    </p>
                  )
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {(["home", "away"] as PredictionOutcome[]).map((outcome) => {
                        const isSelected = selection === outcome;
                        const rank = getOutcomeRank(outcome, match);
                        return (
                          <button
                            key={outcome}
                            onClick={() => handleSelect(match.id, outcome)}
                            disabled={isSaving || !predictionsOpen}
                            className={`rounded-md border px-2 py-2 text-center text-sm font-semibold transition disabled:opacity-60 ${
                              isSelected
                                ? "border-[#00A651] bg-[#00A651] text-white"
                                : "border-[#00A651]/40 bg-[#002820] text-white hover:bg-[#00A651]"
                            }`}
                          >
                            {isSaving && isSelected ? "⏳ " : ""}
                            <PredictionDisplay prediction={outcome} match={match} size={24} />
                            {rank !== undefined && (
                              <span className="ml-1 text-xs font-normal text-white/60">#{rank}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {existingPrediction?.submittedAt && (
                      <p className="mt-2 text-center text-xs text-[#94a3b8]">
                        Last saved: {formatMatchDateShort(existingPrediction.submittedAt)}
                      </p>
                    )}

                    {errors[match.id] && (
                      <p className="mt-2 text-center text-sm text-red-400">{errors[match.id]}</p>
                    )}

                    {!isUnrevealed && (
                      <CrowdBar
                        match={match}
                        counts={pickCountsByMatch.get(match.id) ?? { home: 0, draw: 0, away: 0, total: 0 }}
                        selection={selection}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#00A651] px-5 py-2 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
