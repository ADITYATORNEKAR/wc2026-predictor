"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

const USERNAME_KEY = "wc2026_username";

interface LeaderboardEntry {
  name: string;
  points: number;
}

interface Member {
  userName: string;
  userEmail: string;
}

function getRankDisplay(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}`;
}

export default function LeaguePage({
  params,
}: {
  params: Promise<{ leagueName: string }>;
}) {
  const { leagueName: encodedLeagueName } = use(params);
  const leagueName = decodeURIComponent(encodedLeagueName);

  const [userName, setUserName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUserName(localStorage.getItem(USERNAME_KEY) ?? "");
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [membersRes, leaderboardRes] = await Promise.all([
          fetch(`/api/leagues/${encodeURIComponent(leagueName)}/members`),
          fetch("/api/leaderboard"),
        ]);

        setMembers(await membersRes.json());
        setLeaderboard(await leaderboardRes.json());
      } catch {
        setMembers([]);
        setLeaderboard([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [leagueName]);

  const pointsByName = new Map(leaderboard.map((entry) => [entry.name, entry.points]));

  const ranked = members
    .map((member) => ({
      name: member.userName,
      points: pointsByName.get(member.userName) ?? 0,
    }))
    .sort((a, b) => b.points - a.points);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/leagues" className="text-sm text-[#94a3b8] transition hover:text-white">
        ← All Leagues
      </Link>

      <h1 className="mt-4 font-[family-name:var(--font-heading)] text-4xl tracking-wide text-[#FFD700]">
        {leagueName}
      </h1>

      <div className="mt-8 rounded-lg border border-[#00573F] bg-[#002820] p-4 shadow-lg">
        <div className="mb-4 flex items-center justify-center gap-2 border-b border-[#00A651] pb-3">
          <span className="text-3xl">🏆</span>
          <h2 className="font-[family-name:var(--font-heading)] text-2xl tracking-wide text-[#FFD700]">
            Leaderboard
          </h2>
        </div>

        {loading ? (
          <p className="text-center text-sm text-white">Loading...</p>
        ) : ranked.length === 0 ? (
          <p className="text-center text-sm text-white">No members yet.</p>
        ) : (
          <table className="w-full text-left text-sm text-white">
            <thead>
              <tr className="border-b border-[#00573F] text-[#94a3b8]">
                <th className="py-2 px-2">Rank</th>
                <th className="py-2 px-2">Name</th>
                <th className="py-2 px-2 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((member, index) => {
                const rank = index + 1;
                const isCurrentUser = member.name === userName;

                return (
                  <tr
                    key={member.name}
                    className={`${index % 2 === 0 ? "bg-[#003B2B]" : "bg-[#002820]"} ${
                      isCurrentUser ? "border-2 border-[#FFD700]" : ""
                    }`}
                  >
                    <td className="py-2 px-2 font-semibold">{getRankDisplay(rank)}</td>
                    <td className="py-2 px-2 font-medium">{member.name}</td>
                    <td className="py-2 px-2 text-right font-[family-name:var(--font-heading)] tracking-wide text-[#FFD700]">
                      {member.points} pts
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
