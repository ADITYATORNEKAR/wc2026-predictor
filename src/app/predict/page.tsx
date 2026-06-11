"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MatchCard from "@/components/MatchCard";
import { Match, Prediction } from "@/lib/types";
import { PredictionOutcome, OUTCOME_DISPLAY } from "@/lib/scoring";
import { getFlag } from "@/lib/flags";

const EMAIL_STORAGE_KEY = "wc2026_email";
const RULES_DISMISSED_KEY = "wc2026_rules_dismissed";

function formatPick(outcome: PredictionOutcome, match: Match): string {
  if (outcome === "draw") return "Draw";
  if (outcome === "home") {
    return match.homeTeam
      ? `${getFlag(match.homeTeam)} ${match.homeTeam} Win`
      : `${match.homeTeamPlaceholder ?? "Home"} Win`;
  }
  return match.awayTeam
    ? `${getFlag(match.awayTeam)} ${match.awayTeam} Win`
    : `${match.awayTeamPlaceholder ?? "Away"} Win`;
}

function getMatchdayLabel(match: Match): string {
  if (match.stage !== "Group") {
    switch (match.stage) {
      case "R32":
        return "Round of 32";
      case "R16":
        return "Round of 16";
      case "QF":
        return "Quarter-Finals";
      case "SF":
        return "Semi-Finals";
      case "3rd":
        return "Third Place Playoff";
      case "Final":
        return "Final";
      default:
        return match.stage;
    }
  }

  const num = parseInt(match.id.replace(/\D/g, ""), 10);
  if (num <= 24) return "Matchday 1";
  if (num <= 48) return "Matchday 2";
  return "Matchday 3";
}

export default function PredictPage() {
  const [userEmail, setUserEmail] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selections, setSelections] = useState<Record<string, PredictionOutcome>>({});
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [savedMatchId, setSavedMatchId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    const storedEmail = localStorage.getItem(EMAIL_STORAGE_KEY);
    if (storedEmail) setUserEmail(storedEmail);

    setShowRules(localStorage.getItem(RULES_DISMISSED_KEY) !== "true");

    fetch("/api/matches")
      .then((res) => res.json())
      .then(setMatches)
      .catch(() => setMatches([]));

    fetch("/api/predictions")
      .then((res) => res.json())
      .then(setPredictions)
      .catch(() => setPredictions([]));
  }, []);

  useEffect(() => {
    if (!savedMatchId) return;
    const timer = setTimeout(() => setSavedMatchId(null), 2000);
    return () => clearTimeout(timer);
  }, [savedMatchId]);

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
    for (const match of matches) {
      const label = getMatchdayLabel(match);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(match);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
    }
    return Array.from(groups.entries());
  }, [matches]);

  const getSelection = (matchId: string): PredictionOutcome | undefined => {
    if (selections[matchId]) return selections[matchId];
    return userPredictions.get(matchId)?.prediction;
  };

  const dismissRules = () => {
    localStorage.setItem(RULES_DISMISSED_KEY, "true");
    setShowRules(false);
  };

  const handleSelect = async (matchId: string, outcome: PredictionOutcome) => {
    setSelections((prev) => ({ ...prev, [matchId]: outcome }));
    setErrors((prev) => ({ ...prev, [matchId]: "" }));
    setSavedMatchId(null);
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
        setErrors((prev) => ({ ...prev, [matchId]: data.error ?? "Failed to save prediction" }));
        return;
      }

      const refreshed = await fetch("/api/predictions");
      setPredictions(await refreshed.json());
      setSavedMatchId(matchId);
    } catch {
      setErrors((prev) => ({ ...prev, [matchId]: "Failed to save prediction" }));
    } finally {
      setSavingMatchId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl bg-[#003B2B] px-4 py-8">
      <h1 className="mb-6 font-[family-name:var(--font-heading)] text-4xl tracking-wide text-[#FFD700]">
        Make Your Predictions
      </h1>

      <p className="mb-2 text-sm text-[#94a3b8]">Predicting as: {userEmail}</p>
      <Link href="/my-predictions" className="mb-6 inline-block text-sm text-[#00A651] transition hover:text-[#00A651]/80">
        View all my predictions →
      </Link>

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

      {groupedMatches.map(([label, groupMatches]) => (
        <div key={label} className="mb-8">
          <div className="sticky top-0 z-10 -mx-4 mb-3 bg-[#003B2B] px-4 py-2">
            <h2 className="font-[family-name:var(--font-heading)] text-xl tracking-wide text-[#FFD700]">{label}</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {groupMatches.map((match) => {
              const isPast = new Date(match.matchDate) < new Date();
              const selection = getSelection(match.id);
              const existingPrediction = userPredictions.get(match.id);
              const isSaving = savingMatchId === match.id;
              const justSaved = savedMatchId === match.id;

              return (
                <div key={match.id} className="flex flex-col gap-3">
                  <MatchCard match={match} userPrediction={existingPrediction} />

                  <div className="rounded-lg border border-[#00573F] bg-[#002820] p-4">
                    {isPast ? (
                      existingPrediction ? (
                        <p className="text-center text-[#94a3b8]">
                          Your pick: {OUTCOME_DISPLAY[existingPrediction.prediction]}
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
                                {outcome === "draw" ? "Draw" : formatPick(outcome, match)}
                              </button>
                            );
                          })}
                        </div>

                        {existingPrediction && (
                          <p className="mt-2 text-center text-xs text-[#94a3b8]">
                            {justSaved ? "✓ Updated" : "✏️ Saved — click to change"}
                          </p>
                        )}

                        {errors[match.id] && (
                          <p className="mt-2 text-center text-sm text-red-400">{errors[match.id]}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
