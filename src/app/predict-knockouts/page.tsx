"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MatchCard from "@/components/MatchCard";
import { Match, Prediction } from "@/lib/types";
import { PredictionOutcome } from "@/lib/scoring";
import { getTeamRank } from "@/lib/rankings";
import { KNOCKOUT_MATCHES } from "@/lib/knockout-matches";
import { hasMatchStarted, formatMatchDateShort } from "@/lib/dateUtils";
import TeamFlag from "@/components/TeamFlag";
import PredictionDisplay from "@/components/PredictionDisplay";
import ScoreDisplay from "@/components/ScoreDisplay";

const FINAL_FLAG_EMOJI: Record<string, string> = { Spain: "🇪🇸", Argentina: "🇦🇷" };

const CONSOLATION_MATCH_IDS = new Set(["k1", "k4"]);

const TABS: { label: string; stages: string[] }[] = [
  { label: "Semi Finals",    stages: ["SF"] },
  { label: "Final",          stages: ["Final", "3rd"] },
  { label: "Quarter Finals", stages: ["QF"] },
  { label: "Round of 16",    stages: ["R16"] },
  { label: "Round of 32",    stages: ["R32"] },
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
  if (hasMatchStarted(match.matchDate)) {
    return <span className="rounded-full bg-gray-600 px-2 py-0.5 text-[10px] font-semibold text-white">Predictions Closed</span>;
  }

  if (!match.homeTeam || !match.awayTeam) {
    return (
      <span className="rounded-full bg-[#00573F] px-2 py-0.5 text-[10px] font-semibold text-[#94a3b8]">
        Teams TBD — coming soon
      </span>
    );
  }

  return <span className="rounded-full bg-[#00A651] px-2 py-0.5 text-[10px] font-semibold text-white">Predictions Open</span>;
}

function CountdownTimer({ target }: { target: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const diff = new Date(target).getTime() - now;

  if (diff <= 0) {
    return <p className="text-sm font-semibold text-[#FFD700]">⚽ Kickoff!</p>;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);

  return (
    <div className="flex justify-center gap-4">
      {[
        { label: "Days", value: days },
        { label: "Hours", value: hours },
        { label: "Minutes", value: minutes },
      ].map((unit) => (
        <div key={unit.label} className="flex flex-col items-center rounded-lg bg-[#001a13] px-4 py-2">
          <span className="font-[family-name:var(--font-heading)] text-2xl text-[#FFD700] sm:text-3xl">
            {String(unit.value).padStart(2, "0")}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-[#94a3b8]">{unit.label}</span>
        </div>
      ))}
    </div>
  );
}

function TeamBigCard({ team, rank }: { team: string; rank?: number }) {
  return (
    <div className="flex w-28 flex-col items-center gap-2 sm:w-48">
      <TeamFlag team={team} size={64} className="rounded shadow-lg" />
      <span className="text-center font-[family-name:var(--font-heading)] text-lg tracking-wide text-white sm:text-2xl">
        {team}
      </span>
      {rank !== undefined && (
        <span className="rounded-full bg-[#FFD700]/20 px-2 py-0.5 text-xs font-semibold text-[#FFD700]">
          FIFA #{rank}
        </span>
      )}
    </div>
  );
}

function GrandFinalHero({
  match,
  existingPrediction,
  counts,
  isSaving,
  isPast,
  error,
  onSelect,
}: {
  match: Match;
  existingPrediction?: Prediction;
  counts: PickCounts;
  isSaving: boolean;
  isPast: boolean;
  error?: string;
  onSelect: (outcome: PredictionOutcome) => void;
}) {
  const selection = existingPrediction?.prediction;
  const hasResult = match.actualHome !== undefined && match.actualAway !== undefined;

  return (
    <div className="mb-8 overflow-hidden rounded-2xl border-2 border-[#FFD700] bg-gradient-to-b from-[#001a13] to-[#003B2B] px-6 py-10 text-center shadow-2xl">
      <h2 className="font-[family-name:var(--font-heading)] text-3xl tracking-widest text-[#FFD700] sm:text-5xl">
        🏆 WORLD CUP FINAL 🏆
      </h2>
      <p className="mt-2 text-sm text-white sm:text-base">July 19 · MetLife Stadium · New York</p>

      <div className="mt-8 flex items-center justify-center gap-4 sm:gap-10">
        <TeamBigCard team={match.homeTeam} rank={getTeamRank(match.homeTeam)} />
        <span className="font-[family-name:var(--font-heading)] text-4xl text-[#FFD700] sm:text-6xl">VS</span>
        <TeamBigCard team={match.awayTeam} rank={getTeamRank(match.awayTeam)} />
      </div>

      {isPast ? (
        <div className="mt-8">
          {hasResult ? (
            <>
              <p className="font-[family-name:var(--font-heading)] text-2xl tracking-wide">
                <ScoreDisplay match={match} className="text-white" />
              </p>
              {existingPrediction && (
                <p className={`mt-2 text-sm font-semibold ${existingPrediction.points ? "text-[#00A651]" : "text-red-400"}`}>
                  {existingPrediction.points ? `✅ +${existingPrediction.points} pts` : "❌ 0 pts"}
                </p>
              )}
            </>
          ) : existingPrediction ? (
            <p className="text-sm font-semibold text-orange-400">⏳ Match in progress — predictions locked</p>
          ) : (
            <p className="mx-auto max-w-md rounded-md bg-red-600/20 px-3 py-2 text-sm font-semibold text-red-400">
              🔒 Predictions Closed — You did not make a prediction
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-4">
            {(["home", "away"] as PredictionOutcome[]).map((outcome) => {
              const team = outcome === "home" ? match.homeTeam : match.awayTeam;
              const isSelected = selection === outcome;
              return (
                <button
                  key={outcome}
                  onClick={() => onSelect(outcome)}
                  disabled={isSaving}
                  className={`rounded-lg border-2 px-4 py-3 text-sm font-bold transition disabled:opacity-60 sm:text-base ${
                    isSelected
                      ? "border-[#FFD700] bg-[#FFD700] text-[#003B2B]"
                      : "border-[#FFD700]/50 bg-[#002820] text-[#FFD700] hover:bg-[#FFD700]/20"
                  }`}
                >
                  {FINAL_FLAG_EMOJI[team] ?? ""} {team} to Win
                </button>
              );
            })}
          </div>

          {existingPrediction && (
            <p className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-[#FFD700]">
              ✅ <PredictionDisplay prediction={existingPrediction.prediction} match={match} size={20} /> — ⭐ Pick saved!
            </p>
          )}

          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

          <div className="mx-auto mt-6 max-w-md">
            <CrowdBar match={match} counts={counts} selection={selection} />
          </div>
        </>
      )}

      <div className="mt-8">
        <CountdownTimer target={match.matchDate} />
      </div>

      <p className="mt-4 text-xs italic text-[#94a3b8]">
        ⭐ 50 points if correct — the biggest pick of the tournament!
      </p>
    </div>
  );
}

const EMAIL_STORAGE_KEY = "wc2026_email";

export default function PredictKnockoutsPage() {
  const [userEmail, setUserEmail] = useState("");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [allPredictions, setAllPredictions] = useState<Prediction[]>([]);
  const [matchesData, setMatchesData] = useState<Match[]>(KNOCKOUT_MATCHES);
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

    fetch("/api/matches")
      .then((res) => res.json())
      .then((data: Match[]) => {
        setMatchesData(data.filter((m) => m.stage !== "Group"));
      })
      .catch(() => {});

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
  const tabMatches = matchesData
    .filter((m) => (tab.stages as string[]).includes(m.stage))
    .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());

  const isFinalTab = tab.label === "Final";
  const finalMatch = isFinalTab ? tabMatches.find((m) => m.stage === "Final") : undefined;
  const gridMatches = isFinalTab ? tabMatches.filter((m) => m.stage === "3rd") : tabMatches;

  const finalRawPrediction = finalMatch ? userPredictions.get(finalMatch.id) : undefined;
  const finalExistingPrediction = finalRawPrediction?.prediction === "draw" ? undefined : finalRawPrediction;
  const finalIsPast = finalMatch ? hasMatchStarted(finalMatch.matchDate) || lockedMatchIds.has(finalMatch.id) : false;

  return (
    <div className="mx-auto max-w-5xl bg-[#003B2B] px-4 py-8">
      <h1 className="mb-6 font-[family-name:var(--font-heading)] text-4xl tracking-wide text-[#FFD700]">
        ⚔️ PREDICT KNOCKOUTS
      </h1>

      <p className="mb-2 text-sm text-[#94a3b8]">Predicting as: {userEmail}</p>
      <Link href="/my-predictions" className="mb-6 inline-block text-sm text-[#00A651] transition hover:text-[#00A651]/80">
        View all my predictions →
      </Link>

      {isFinalTab && (
        <div className="mb-6 rounded-lg border border-[#2d6a4f] bg-[#1b4332] px-4 py-3 text-center text-sm font-semibold text-[#FFD700]">
          🏆 The Final is Set — Spain vs Argentina · July 19 · Predict the World Cup Winner!
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
        {TABS.map((t, index) => {
          const isSF = t.label === "Semi Finals";
          const isFinal = t.label === "Final";
          const isActive = activeTab === index;

          if (isFinal) {
            return (
              <button
                key={t.label}
                onClick={() => setActiveTab(index)}
                className={`rounded-md px-5 py-2.5 text-lg font-extrabold uppercase tracking-wider transition ${
                  isActive ? "final-tab-shimmer text-[#1a1300]" : "final-tab-muted text-[#FFD700]"
                }`}
              >
                🏆 {t.label}
              </button>
            );
          }

          if (isSF) {
            return (
              <button
                key={t.label}
                onClick={() => setActiveTab(index)}
                className={`rounded-md px-4 py-2 text-base font-bold transition ${
                  isActive ? "sf-tab-glow" : "sf-tab-muted"
                }`}
                style={{
                  background: isActive
                    ? "linear-gradient(135deg, #FFD700, #FFA500)"
                    : "linear-gradient(135deg, rgba(255,215,0,0.35), rgba(255,165,0,0.35))",
                  color: isActive ? "#003B2B" : "#FFD700",
                }}
              >
                🏆 {t.label}
              </button>
            );
          }

          return (
            <button
              key={t.label}
              onClick={() => setActiveTab(index)}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? "bg-[#00A651] text-white"
                  : "bg-[#002820] text-[#94a3b8] hover:text-white"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {isFinalTab && finalMatch && (
        <GrandFinalHero
          match={finalMatch}
          existingPrediction={finalExistingPrediction}
          counts={pickCountsByMatch.get(finalMatch.id) ?? { home: 0, draw: 0, away: 0, total: 0 }}
          isSaving={savingMatchId === finalMatch.id}
          isPast={finalIsPast}
          error={errors[finalMatch.id]}
          onSelect={(outcome) => handleSelect(finalMatch.id, outcome)}
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {gridMatches.map((match) => {
          const isUnrevealed = !match.homeTeam || !match.awayTeam;
          const isConsolation = CONSOLATION_MATCH_IDS.has(match.id);
          const started = hasMatchStarted(match.matchDate);
          const isPast = started || lockedMatchIds.has(match.id);
          const predictionsOpen = !isUnrevealed && !isPast;

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
