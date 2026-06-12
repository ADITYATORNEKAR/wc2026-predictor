"use client";

import { useEffect, useMemo, useState } from "react";
import { getFlag } from "@/lib/flags";
import { FIFA_RANKINGS } from "@/lib/rankings";
import { TOP_SCORER_OPTIONS, ALL_WC_TEAMS } from "@/lib/special-picks";
import { SpecialPrediction } from "@/lib/types";

const EMAIL_KEY = "wc2026_email";
const USERNAME_KEY = "wc2026_username";

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function SpecialPicksPage() {
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [topScorerPick, setTopScorerPick] = useState<string | null>(null);
  const [wcWinnerPick, setWcWinnerPick] = useState<string | null>(null);
  const [existingPicks, setExistingPicks] = useState<SpecialPrediction[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const storedEmail = localStorage.getItem(EMAIL_KEY) ?? "";
    const storedUserName = localStorage.getItem(USERNAME_KEY) ?? "";
    setUserEmail(storedEmail);
    setUserName(storedUserName);

    fetch(`/api/special-predictions?userName=${encodeURIComponent(storedUserName)}`)
      .then((res) => res.json())
      .then((data: SpecialPrediction[]) => {
        setExistingPicks(data);
        const topScorer = data.find((p) => p.type === "topscorer");
        const wcWinner = data.find((p) => p.type === "wcwinner");
        if (topScorer) setTopScorerPick(topScorer.pick);
        if (wcWinner) setWcWinnerPick(wcWinner.pick);
      })
      .catch(() => setExistingPicks([]))
      .finally(() => setLoading(false));
  }, []);

  const sortedTeams = useMemo(() => {
    return [...ALL_WC_TEAMS]
      .sort((a, b) => (FIFA_RANKINGS[a] ?? 999) - (FIFA_RANKINGS[b] ?? 999))
      .filter((team) => team.toLowerCase().includes(search.toLowerCase()));
  }, [search]);

  const filteredPlayers = useMemo(() => {
    const query = playerSearch.toLowerCase();
    return TOP_SCORER_OPTIONS.filter(
      (player) => player.name.toLowerCase().includes(query) || player.team.toLowerCase().includes(query)
    );
  }, [playerSearch]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    try {
      const requests: Promise<Response>[] = [];

      if (topScorerPick) {
        requests.push(
          fetch("/api/special-predictions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userName, userEmail, type: "topscorer", pick: topScorerPick }),
          })
        );
      }

      if (wcWinnerPick) {
        requests.push(
          fetch("/api/special-predictions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userName, userEmail, type: "wcwinner", pick: wcWinnerPick }),
          })
        );
      }

      const responses = await Promise.all(requests);

      if (responses.some((res) => !res.ok)) {
        setSaveMessage("Failed to save one or more picks");
        return;
      }

      const refreshed = await fetch(`/api/special-predictions?userName=${encodeURIComponent(userName)}`);
      setExistingPicks(await refreshed.json());
      setSaveMessage("🌟 Bonus picks saved!");
    } catch {
      setSaveMessage("Failed to save bonus picks");
    } finally {
      setSaving(false);
    }
  };

  const topScorerEntry = existingPicks.find((p) => p.type === "topscorer");
  const wcWinnerEntry = existingPicks.find((p) => p.type === "wcwinner");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 font-[family-name:var(--font-heading)] text-4xl tracking-wide text-[#FFD700]">
        🌟 Bonus Predictions
      </h1>

      {loading ? (
        <p className="text-sm text-[#94a3b8]">Loading your bonus picks...</p>
      ) : (
        <>
          <section className="mb-10">
            <h2 className="mb-1 font-[family-name:var(--font-heading)] text-2xl tracking-wide text-[#FFD700]">
              🥅 Golden Boot — Who scores the most goals?
            </h2>
            <p className="mb-4 text-sm text-[#94a3b8]">🎯 30 pts if correct</p>

            <input
              type="text"
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              placeholder="Search players or countries..."
              className="mb-4 w-full rounded-md border border-[#00573F] bg-[#002820] px-3 py-2 text-white placeholder-white/40 focus:border-[#00A651] focus:outline-none sm:max-w-xs"
            />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filteredPlayers.map((player) => {
                const isSelected = topScorerPick === player.id;
                return (
                  <button
                    key={player.id}
                    onClick={() => setTopScorerPick(player.id)}
                    className={`relative rounded-lg border p-3 text-center transition ${
                      isSelected
                        ? "border-[#FFD700] bg-[#00A651]/20"
                        : "border-[#00573F] bg-[#002820] hover:border-[#00A651]"
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute right-2 top-2 text-base text-[#FFD700]">✓</span>
                    )}
                    <div className="text-4xl">{player.flag}</div>
                    <div className="mt-1 font-[family-name:var(--font-heading)] text-sm font-bold tracking-wide text-white">
                      {player.name}
                    </div>
                    <div className="mt-1 flex items-center justify-center gap-1 text-xs text-[#00A651]">
                      <span>{player.team}</span>
                      <span className="rounded bg-[#001a13] px-1 py-0.5 text-[9px] font-semibold text-[#94a3b8]">
                        #{player.rank}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] font-semibold text-[#FFD700]">🎯 30 pts if correct</div>
                  </button>
                );
              })}
              {filteredPlayers.length === 0 && (
                <p className="col-span-full text-center text-sm text-[#94a3b8]">No players match your search.</p>
              )}
            </div>
          </section>

          <section className="mb-10">
            <h2 className="mb-1 font-[family-name:var(--font-heading)] text-2xl tracking-wide text-[#FFD700]">
              🏆 World Cup Winner — Which country lifts the trophy?
            </h2>
            <p className="mb-4 text-sm text-[#94a3b8]">🏆 50 pts if correct</p>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search countries..."
              className="mb-4 w-full rounded-md border border-[#00573F] bg-[#002820] px-3 py-2 text-white placeholder-white/40 focus:border-[#00A651] focus:outline-none sm:max-w-xs"
            />

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {sortedTeams.map((team) => {
                const isSelected = wcWinnerPick === team;
                return (
                  <button
                    key={team}
                    onClick={() => setWcWinnerPick(team)}
                    className={`flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-center transition ${
                      isSelected
                        ? "border-[#FFD700] bg-[#00A651]/20"
                        : "border-[#00573F] bg-[#002820] hover:border-[#00A651]"
                    }`}
                  >
                    <span className="text-2xl">{getFlag(team)}</span>
                    <span className="text-xs font-semibold text-white">{team}</span>
                    <span className="rounded bg-[#001a13] px-1 py-0.5 text-[9px] font-semibold text-[#94a3b8]">
                      #{FIFA_RANKINGS[team] ?? "-"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {(topScorerEntry || wcWinnerEntry) && (
            <section className="mb-10 rounded-lg border border-[#00573F] bg-[#002820] p-4">
              <h2 className="mb-3 font-[family-name:var(--font-heading)] text-xl tracking-wide text-[#FFD700]">
                Your Current Bonus Picks
              </h2>
              <ul className="space-y-2 text-sm text-white">
                {topScorerEntry && (
                  <li>
                    🥅 Golden Boot:{" "}
                    <span className="font-semibold">
                      {TOP_SCORER_OPTIONS.find((p) => p.id === topScorerEntry.pick)?.name ?? topScorerEntry.pick}
                    </span>{" "}
                    <span className="text-[#94a3b8]">
                      (saved {formatTimestamp(topScorerEntry.submittedAt)})
                    </span>
                  </li>
                )}
                {wcWinnerEntry && (
                  <li>
                    🏆 World Cup Winner:{" "}
                    <span className="font-semibold">
                      {getFlag(wcWinnerEntry.pick)} {wcWinnerEntry.pick}
                    </span>{" "}
                    <span className="text-[#94a3b8]">
                      (saved {formatTimestamp(wcWinnerEntry.submittedAt)})
                    </span>
                  </li>
                )}
              </ul>
            </section>
          )}

          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving || (!topScorerPick && !wcWinnerPick)}
              className="rounded-md bg-[#00A651] px-6 py-2 font-semibold text-white transition hover:bg-[#00A651]/80 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Bonus Picks"}
            </button>
            {saveMessage && <p className="text-sm text-[#FFD700]">{saveMessage}</p>}
          </div>
        </>
      )}
    </div>
  );
}
