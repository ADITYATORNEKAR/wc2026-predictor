"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MatchCard from "@/components/MatchCard";
import { Match, Prediction } from "@/lib/types";
import { PredictionOutcome, getPredictionDisplay } from "@/lib/scoring";
import { FLAG_MAP, getFlag } from "@/lib/flags";
import { FIFA_RANKINGS } from "@/lib/rankings";
import { MATCHES } from "@/lib/matches";
import { hasMatchStarted, formatMatchDateShort } from "@/lib/dateUtils";

function getOutcomeRank(outcome: PredictionOutcome, match: Match): number | undefined {
  if (outcome === "draw") return undefined;
  const team = outcome === "home" ? match.homeTeam : match.awayTeam;
  if (!team) return undefined;
  return FIFA_RANKINGS[team];
}

interface PickCounts {
  home: number;
  draw: number;
  away: number;
  total: number;
}

function CrowdBar({ match, counts, selection }: { match: Match; counts: PickCounts; selection?: PredictionOutcome }) {
  if (counts.total === 0) {
    return <p className="mt-3 text-center text-xs italic text-[#94a3b8]">Be the first to predict this match!</p>;
  }

  const homePct = Math.round((counts.home / counts.total) * 100);
  const drawPct = Math.round((counts.draw / counts.total) * 100);
  const awayPct = 100 - homePct - drawPct;

  const segmentClasses = (outcome: PredictionOutcome) =>
    selection === outcome ? "ring-2 ring-inset ring-white" : "";

  return (
    <div className="mt-3">
      <p className="text-center text-xs text-[#94a3b8]">
        👥 {counts.total} pick{counts.total === 1 ? "" : "s"} so far
      </p>
      <div className="mt-1 flex h-2 w-full overflow-hidden rounded-full bg-[#001a13]">
        <div className={`bg-[#00A651] ${segmentClasses("home")}`} style={{ width: `${homePct}%` }} />
        <div className={`bg-[#6b7280] ${segmentClasses("draw")}`} style={{ width: `${drawPct}%` }} />
        <div className={`bg-[#3b82f6] ${segmentClasses("away")}`} style={{ width: `${awayPct}%` }} />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-[#94a3b8]">
        <span>{getFlag(match.homeTeam)} {homePct}%</span>
        <span>{drawPct}% 🤝</span>
        <span>{awayPct}% {getFlag(match.awayTeam)}</span>
      </div>
    </div>
  );
}

const EMAIL_STORAGE_KEY = "wc2026_email";
const RULES_DISMISSED_KEY = "wc2026_rules_dismissed";

const GROUP_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

export default function PredictGroupsPage() {
  const [userEmail, setUserEmail] = useState("");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [allPredictions, setAllPredictions] = useState<Prediction[]>([]);
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [lockedMatchIds, setLockedMatchIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [predictionsLoading, setPredictionsLoading] = useState(true);
  const [predictionsError, setPredictionsError] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string>("A");

  useEffect(() => {
    const storedEmail = localStorage.getItem(EMAIL_STORAGE_KEY);
    if (storedEmail) setUserEmail(storedEmail);

    setShowRules(localStorage.getItem(RULES_DISMISSED_KEY) !== "true");

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

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveGroup(entry.target.id.replace("group-", ""));
          }
        }
      },
      { rootMargin: "-120px 0px -70% 0px" }
    );

    for (const letter of GROUP_LETTERS) {
      const el = document.getElementById(`group-${letter}`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

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

  const groupedMatches = useMemo(() => {
    const groups = new Map<string, Match[]>();
    for (const match of MATCHES) {
      if (!groups.has(match.group)) groups.set(match.group, []);
      groups.get(match.group)!.push(match);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, []);

  const groupTeams = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [letter, groupMatches] of groupedMatches) {
      const teams: string[] = [];
      for (const match of groupMatches) {
        if (!teams.includes(match.homeTeam)) teams.push(match.homeTeam);
        if (!teams.includes(match.awayTeam)) teams.push(match.awayTeam);
      }
      map.set(letter, teams);
    }
    return map;
  }, [groupedMatches]);

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

  const dismissRules = () => {
    localStorage.setItem(RULES_DISMISSED_KEY, "true");
    setShowRules(false);
  };

  const scrollToGroup = (letter: string) => {
    const el = document.getElementById(`group-${letter}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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

  return (
    <div className="mx-auto max-w-5xl bg-[#003B2B] px-4 py-8">
      <h1 className="mb-6 font-[family-name:var(--font-heading)] text-4xl tracking-wide text-[#FFD700]">
        🗓️ PREDICT GROUP STAGE
      </h1>

      <p className="mb-2 text-sm text-[#94a3b8]">Predicting as: {userEmail}</p>
      <Link href="/my-predictions" className="mb-6 inline-block text-sm text-[#00A651] transition hover:text-[#00A651]/80">
        View all my predictions →
      </Link>

      {predictionsLoading && (
        <p className="mb-6 text-sm text-[#94a3b8]">⏳ Loading your predictions...</p>
      )}

      {predictionsError && (
        <p className="mb-6 rounded-md bg-red-600/20 px-3 py-2 text-sm font-semibold text-red-400">
          {predictionsError}
        </p>
      )}

      {showRules && (
        <div className="mb-6 rounded-lg border border-[#00A651] bg-[#002820] p-4">
          <h2 className="mb-2 font-[family-name:var(--font-heading)] text-lg tracking-wide text-[#FFD700]">
            📋 How to Play
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-white">
            <li>For each match, predict the result: Home Win, Draw, or Away Win</li>
            <li>Submit your prediction before the match kicks off — predictions lock at kickoff</li>
            <li>Correct prediction = 3 points | Wrong prediction = 0 points</li>
            <li>Come back anytime to predict remaining matches — no need to do all at once</li>
            <li>You can change your prediction up until kickoff</li>
            <li>
              View your score and ranking on the{" "}
              <Link href="/leaderboard" className="text-[#00A651] underline hover:text-[#00A651]/80">
                Leaderboard
              </Link>
            </li>
          </ul>
          <button
            onClick={dismissRules}
            className="mt-3 rounded-md bg-[#00A651] px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-[#00A651]/80"
          >
            Got it
          </button>
        </div>
      )}

      <div className="sticky top-0 z-20 -mx-4 mb-6 flex gap-2 overflow-x-auto bg-[#003B2B] px-4 py-3 shadow-md">
        <span className="flex-shrink-0 self-center text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
          Jump to:
        </span>
        {GROUP_LETTERS.map((letter) => (
          <button
            key={letter}
            onClick={() => scrollToGroup(letter)}
            className={`flex-shrink-0 rounded-full px-3 py-1 text-sm font-semibold transition ${
              activeGroup === letter
                ? "bg-[#FFD700] text-[#003B2B]"
                : "bg-[#002820] text-white hover:bg-[#00A651]"
            }`}
          >
            {letter}
          </button>
        ))}
      </div>

      {groupedMatches.map(([letter, groupMatches], index) => (
        <div key={letter}>
          <section id={`group-${letter}`} className="mb-8 scroll-mt-24">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md bg-[#002820] px-4 py-3">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl tracking-wide text-[#FFD700]">
                GROUP {letter}
              </h2>
              <p className="text-xs text-white">
                {(groupTeams.get(letter) ?? []).join(" · ")}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {groupMatches.map((match) => {
                const isPast = hasMatchStarted(match.matchDate) || lockedMatchIds.has(match.id);
                const existingPrediction = userPredictions.get(match.id);
                const selection = existingPrediction?.prediction;
                const isSaving = savingMatchId === match.id;

                return (
                  <div key={match.id} className="flex flex-col gap-3">
                    <MatchCard match={match} userPrediction={existingPrediction} />

                    <div className="rounded-lg border border-[#00573F] bg-[#002820] p-4">
                      {isPast ? (
                        existingPrediction ? (
                          <p className="text-center text-[#94a3b8]">
                            Your pick: {getPredictionDisplay(existingPrediction.prediction, match, FLAG_MAP)}
                          </p>
                        ) : (
                          <p className="rounded-md bg-red-600/20 px-3 py-2 text-center text-sm font-semibold text-red-400">
                            🔒 Predictions Closed — You did not make a prediction
                          </p>
                        )
                      ) : (
                        <>
                          <div className="grid grid-cols-3 gap-2">
                            {(["home", "draw", "away"] as PredictionOutcome[]).map((outcome) => {
                              const isSelected = selection === outcome;
                              const rank = getOutcomeRank(outcome, match);
                              return (
                                <button
                                  key={outcome}
                                  onClick={() => handleSelect(match.id, outcome)}
                                  disabled={isSaving}
                                  className={`rounded-md border px-2 py-2 text-center text-sm font-semibold transition disabled:opacity-60 ${
                                    isSelected
                                      ? "border-[#00A651] bg-[#00A651] text-white"
                                      : "border-[#00A651]/40 bg-[#002820] text-white hover:bg-[#00A651]"
                                  }`}
                                >
                                  {isSaving && isSelected ? "⏳ " : ""}
                                  {getPredictionDisplay(outcome, match, FLAG_MAP)}
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

                          <CrowdBar
                            match={match}
                            counts={pickCountsByMatch.get(match.id) ?? { home: 0, draw: 0, away: 0, total: 0 }}
                            selection={selection}
                          />
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {index < groupedMatches.length - 1 && <hr className="my-8 border-t border-[#00A651]/30" />}
        </div>
      ))}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#00A651] px-5 py-2 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
