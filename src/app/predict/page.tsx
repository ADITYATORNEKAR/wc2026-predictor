"use client";

import { useEffect, useMemo, useState } from "react";
import MatchCard from "@/components/MatchCard";
import { Match, Prediction } from "@/lib/types";

const EMAIL_STORAGE_KEY = "wc2026_email";

interface ScoreInput {
  home: string;
  away: string;
}

export default function PredictPage() {
  const [userEmail, setUserEmail] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [scores, setScores] = useState<Record<string, ScoreInput>>({});
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const storedEmail = localStorage.getItem(EMAIL_STORAGE_KEY);
    if (storedEmail) setUserEmail(storedEmail);

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
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
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

  const getScoreInput = (matchId: string): ScoreInput => {
    if (scores[matchId]) return scores[matchId];
    const existing = userPredictions.get(matchId);
    return {
      home: existing ? String(existing.predictedHome) : "",
      away: existing ? String(existing.predictedAway) : "",
    };
  };

  const handleScoreChange = (matchId: string, field: "home" | "away", value: string) => {
    setScores((prev) => ({
      ...prev,
      [matchId]: {
        ...getScoreInput(matchId),
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (matchId: string) => {
    const input = getScoreInput(matchId);
    setErrors((prev) => ({ ...prev, [matchId]: "" }));

    const home = Number(input.home);
    const away = Number(input.away);

    if (
      input.home === "" ||
      input.away === "" ||
      !Number.isInteger(home) ||
      !Number.isInteger(away) ||
      home < 0 ||
      home > 20 ||
      away < 0 ||
      away > 20
    ) {
      setErrors((prev) => ({ ...prev, [matchId]: "Scores must be whole numbers between 0 and 20" }));
      return;
    }

    setSavingMatchId(matchId);

    try {
      const response = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName,
          userEmail,
          matchId,
          predictedHome: home,
          predictedAway: away,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors((prev) => ({ ...prev, [matchId]: data.error ?? "Failed to save prediction" }));
        return;
      }

      setToast("Prediction saved! ⚽");

      const refreshed = await fetch("/api/predictions");
      setPredictions(await refreshed.json());
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

      <p className="mb-6 text-sm text-[#94a3b8]">Predicting as: {userEmail}</p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {matches.map((match) => {
          const isPast = new Date(match.matchDate) < new Date();
          const input = getScoreInput(match.id);
          const existingPrediction = userPredictions.get(match.id);
          const isSaving = savingMatchId === match.id;

          return (
            <div key={match.id} className="flex flex-col gap-3">
              <MatchCard match={match} userPrediction={existingPrediction} />

              <div className="rounded-lg border border-[#00573F] bg-[#002820] p-4">
                {isPast && (
                  <p className="mb-3 rounded-md bg-red-600/20 px-3 py-2 text-center text-sm font-semibold text-red-400">
                    🔒 Predictions Closed
                  </p>
                )}

                <div className="flex items-center justify-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={input.home}
                    onChange={(e) => handleScoreChange(match.id, "home", e.target.value)}
                    disabled={isPast}
                    className="w-16 rounded-md border border-[#00573F] bg-[#003B2B] px-2 py-1 text-center text-white focus:border-[#00A651] focus:outline-none disabled:opacity-50"
                  />
                  <span className="text-white">-</span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={input.away}
                    onChange={(e) => handleScoreChange(match.id, "away", e.target.value)}
                    disabled={isPast}
                    className="w-16 rounded-md border border-[#00573F] bg-[#003B2B] px-2 py-1 text-center text-white focus:border-[#00A651] focus:outline-none disabled:opacity-50"
                  />
                </div>

                {errors[match.id] && (
                  <p className="mt-2 text-center text-sm text-red-400">{errors[match.id]}</p>
                )}

                {!isPast && (
                  <button
                    onClick={() => handleSubmit(match.id)}
                    disabled={isSaving}
                    className="mt-3 w-full rounded-md bg-[#00A651] px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-[#00A651]/80 disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : existingPrediction ? "Update Prediction" : "Save Prediction"}
                  </button>
                )}

                {isPast && (
                  <button
                    disabled
                    className="mt-3 w-full rounded-md bg-[#00A651] px-4 py-1.5 text-sm font-semibold text-white opacity-50"
                  >
                    Save Prediction
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-[#00573F] px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
