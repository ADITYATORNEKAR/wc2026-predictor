"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const EMAIL_KEY = "wc2026_email";
const USERNAME_KEY = "wc2026_username";
const LEAGUE_KEY = "wc2026_league";

interface LeaderboardEntry {
  name: string;
  points: number;
}

interface Member {
  userName: string;
  userEmail: string;
}

interface LeagueSummary {
  name: string;
  memberCount: number;
  topScorer: { name: string; points: number } | null;
}

function getRankDisplay(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}`;
}

export default function LeaguesPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userLeague, setUserLeague] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myTeamMembers, setMyTeamMembers] = useState<Member[]>([]);
  const [leagueSummaries, setLeagueSummaries] = useState<LeagueSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUserEmail(localStorage.getItem(EMAIL_KEY) ?? "");
    setUserName(localStorage.getItem(USERNAME_KEY) ?? "");
    setUserLeague(localStorage.getItem(LEAGUE_KEY) ?? "");
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [leaguesRes, leaderboardRes] = await Promise.all([
          fetch("/api/leagues"),
          fetch("/api/leaderboard"),
        ]);

        const leagues: string[] = await leaguesRes.json();
        const leaderboardData: LeaderboardEntry[] = await leaderboardRes.json();
        setLeaderboard(leaderboardData);

        const pointsByName = new Map(leaderboardData.map((entry) => [entry.name, entry.points]));

        const summaries = await Promise.all(
          leagues.map(async (league) => {
            try {
              const res = await fetch(`/api/leagues/${encodeURIComponent(league)}/members`);
              const members: Member[] = await res.json();

              let topScorer: { name: string; points: number } | null = null;
              for (const member of members) {
                const points = pointsByName.get(member.userName) ?? 0;
                if (!topScorer || points > topScorer.points) {
                  topScorer = { name: member.userName, points };
                }
              }

              return { name: league, memberCount: members.length, topScorer } as LeagueSummary;
            } catch {
              return { name: league, memberCount: 0, topScorer: null } as LeagueSummary;
            }
          })
        );

        setLeagueSummaries(summaries);
      } catch {
        setLeagueSummaries([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    if (!userLeague || userLeague === "none") return;

    fetch(`/api/leagues/${encodeURIComponent(userLeague)}/members`)
      .then((res) => res.json())
      .then(setMyTeamMembers)
      .catch(() => setMyTeamMembers([]));
  }, [userLeague]);

  const pointsByName = new Map(leaderboard.map((entry) => [entry.name, entry.points]));

  const myTeamRanked = myTeamMembers
    .map((member) => ({
      name: member.userName,
      points: pointsByName.get(member.userName) ?? 0,
    }))
    .sort((a, b) => b.points - a.points);

  const showMyTeam = userLeague && userLeague !== "none";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-[family-name:var(--font-heading)] text-4xl tracking-wide text-[#FFD700]">
        Leagues
      </h1>

      {showMyTeam && (
        <section className="mt-8">
          <div className="mb-4 flex items-center gap-2 border-b border-[#00A651] pb-3">
            <span className="text-3xl">🏆</span>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl tracking-wide text-[#FFD700]">
              My Team: {userLeague}
            </h2>
          </div>

          <div className="rounded-lg border border-[#00573F] bg-[#002820] p-4 shadow-lg">
            {myTeamRanked.length === 0 ? (
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
                  {myTeamRanked.map((member, index) => {
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
        </section>
      )}

      <section className="mt-8">
        <div className="mb-4 flex items-center gap-2 border-b border-[#00A651] pb-3">
          <span className="text-3xl">⚽</span>
          <h2 className="font-[family-name:var(--font-heading)] text-2xl tracking-wide text-[#FFD700]">
            All Team Leagues
          </h2>
        </div>

        {loading ? (
          <p className="text-center text-sm text-white">Loading leagues...</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {leagueSummaries.map((league) => (
              <button
                key={league.name}
                onClick={() => router.push(`/leagues/${encodeURIComponent(league.name)}`)}
                className="rounded-lg border border-[#00573F] bg-[#002820] p-4 text-left shadow-lg transition hover:border-[#00A651]"
              >
                <h3 className="font-[family-name:var(--font-heading)] text-xl tracking-wide text-[#FFD700]">
                  {league.name}
                </h3>
                <p className="mt-2 text-sm text-[#94a3b8]">
                  {league.memberCount} {league.memberCount === 1 ? "member" : "members"}
                </p>
                {league.topScorer && (
                  <p className="mt-1 text-sm text-white">
                    Top scorer: <span className="font-semibold">{league.topScorer.name}</span> —{" "}
                    <span className="text-[#FFD700]">{league.topScorer.points} pts</span>
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
