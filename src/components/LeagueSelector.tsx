"use client";

import { useEffect, useState } from "react";

const EMAIL_KEY = "wc2026_email";
const USERNAME_KEY = "wc2026_username";
const LEAGUE_KEY = "wc2026_league";

export default function LeagueSelector({ children }: { children: React.ReactNode }) {
  const [leagues, setLeagues] = useState<string[]>([]);
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/leagues")
      .then((res) => res.json())
      .then(setLeagues)
      .catch(() => setLeagues([]));
  }, []);

  const handleSelect = async (leagueName: string) => {
    setJoining(leagueName);
    setError("");

    const userEmail = localStorage.getItem(EMAIL_KEY) ?? "";
    const userName = localStorage.getItem(USERNAME_KEY) ?? "";

    try {
      const response = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName, userEmail, leagueName }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to join league");
        setJoining(null);
        return;
      }

      localStorage.setItem(LEAGUE_KEY, leagueName);
      setDone(true);
    } catch {
      setError("Failed to join league");
      setJoining(null);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(LEAGUE_KEY, "none");
    setDone(true);
  };

  if (done) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#003B2B]">
      <div className="mx-4 w-full max-w-lg rounded-lg border border-[#00573F] bg-[#002820] p-8 text-center shadow-2xl">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl tracking-wide text-[#FFD700]">
          Join Your Team League
        </h1>
        <p className="mt-2 text-sm text-white">
          Select your Citizens team to compete on a team leaderboard
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {leagues.map((league) => (
            <button
              key={league}
              onClick={() => handleSelect(league)}
              disabled={joining !== null}
              className="rounded-md border border-[#00573F] bg-[#003B2B] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#00A651] disabled:opacity-60"
            >
              {joining === league ? "Joining..." : league}
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <button
          onClick={handleSkip}
          className="mt-6 text-xs text-[#94a3b8] underline transition hover:text-white"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
