"use client";

import { useEffect, useMemo, useState } from "react";
import { Match, Prediction } from "@/lib/types";
import { PredictionOutcome } from "@/lib/scoring";
import { getTeamRank } from "@/lib/rankings";
import { hasMatchStarted } from "@/lib/dateUtils";
import TeamFlag from "./TeamFlag";
import PredictionDisplay from "./PredictionDisplay";
import ScoreDisplay from "./ScoreDisplay";

const FINAL_FLAG_EMOJI: Record<string, string> = { Spain: "🇪🇸", Argentina: "🇦🇷" };
const EMAIL_STORAGE_KEY = "wc2026_email";

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

export default function GrandFinalHero() {
  const [userEmail, setUserEmail] = useState("");
  const [match, setMatch] = useState<Match | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [allPredictions, setAllPredictions] = useState<Prediction[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const storedEmail = localStorage.getItem(EMAIL_STORAGE_KEY);
    if (storedEmail) setUserEmail(storedEmail);
    const resolvedUserName = storedEmail ? storedEmail.split("@")[0] : "";

    fetch("/api/matches")
      .then((res) => res.json())
      .then((data: Match[]) => {
        const final = data.find((m) => m.stage === "Final");
        if (final) setMatch(final);
      })
      .catch(() => {});

    fetch(`/api/predictions?userName=${encodeURIComponent(resolvedUserName)}`)
      .then((res) => res.json())
      .then(setPredictions)
      .catch(() => setPredictions([]));

    fetch("/api/predictions")
      .then((res) => res.json())
      .then(setAllPredictions)
      .catch(() => setAllPredictions([]));
  }, []);

  const userName = useMemo(() => userEmail.split("@")[0], [userEmail]);

  const existingPrediction = useMemo(() => {
    if (!match) return undefined;
    const found = predictions.find((p) => p.userName === userName && p.matchId === match.id);
    return found?.prediction === "draw" ? undefined : found;
  }, [predictions, userName, match]);

  const counts = useMemo(() => {
    const result: PickCounts = { home: 0, draw: 0, away: 0, total: 0 };
    if (!match) return result;
    for (const p of allPredictions) {
      if (p.matchId !== match.id) continue;
      result[p.prediction]++;
      result.total++;
    }
    return result;
  }, [allPredictions, match]);

  const handleSelect = async (outcome: PredictionOutcome) => {
    if (!match) return;
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName, userEmail, matchId: match.id, prediction: outcome }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (typeof data.error === "string" && data.error.toLowerCase().includes("started")) {
          setLocked(true);
        } else {
          setError(data.error ?? "Failed to save prediction");
        }
        return;
      }

      const submittedAt = new Date().toISOString();
      const updated: Prediction = { id: match.id, userName, matchId: match.id, prediction: outcome, submittedAt };

      setPredictions((prev) => [...prev.filter((p) => !(p.userName === userName && p.matchId === match.id)), updated]);
      setAllPredictions((prev) => [...prev.filter((p) => !(p.userName === userName && p.matchId === match.id)), updated]);
    } catch {
      setError("Failed to save prediction");
    } finally {
      setIsSaving(false);
    }
  };

  if (!match) return null;

  const selection = existingPrediction?.prediction;
  const hasResult = match.actualHome !== undefined && match.actualAway !== undefined;
  const isPast = hasMatchStarted(match.matchDate) || locked;

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
                  onClick={() => handleSelect(outcome)}
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

      <p className="mt-4 text-xs italic text-[#FFD700]">
        ⭐ 50 points if correct — the biggest pick of the tournament!
      </p>
    </div>
  );
}
