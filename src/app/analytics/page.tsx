"use client";

import { useEffect, useMemo, useState } from "react";
import { Match, Prediction, SpecialPrediction } from "@/lib/types";
import { getFlag } from "@/lib/flags";
import { FIFA_RANKINGS } from "@/lib/rankings";
import { TOP_SCORER_OPTIONS, ALL_WC_TEAMS } from "@/lib/special-picks";

const REFRESH_INTERVAL_MS = 60000;

interface LeaderboardEntry {
  name: string;
  points: number;
  totalPoints: number;
  matchPoints: number;
  specialPoints: number;
}

interface Member {
  userName: string;
  userEmail: string;
}

interface LeagueSummary {
  name: string;
  memberCount: number;
  averagePoints: number;
  topScorer: { name: string; points: number } | null;
  topMembers: { name: string; points: number }[];
}

function PickBar({ homePct, drawPct, awayPct }: { homePct: number; drawPct: number; awayPct: number }) {
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#001a13]">
      <div className="bg-[#00A651]" style={{ width: `${homePct}%` }} />
      <div className="bg-gray-400" style={{ width: `${drawPct}%` }} />
      <div className="bg-blue-500" style={{ width: `${awayPct}%` }} />
    </div>
  );
}

export default function AnalyticsPage() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [specialPredictions, setSpecialPredictions] = useState<SpecialPrediction[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leagueSummaries, setLeagueSummaries] = useState<LeagueSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [predictionsRes, matchesRes, specialRes, leaderboardRes] = await Promise.all([
          fetch("/api/predictions"),
          fetch("/api/matches"),
          fetch("/api/special-predictions"),
          fetch("/api/leaderboard"),
        ]);

        const predictionsData: Prediction[] = await predictionsRes.json();
        const matchesData: Match[] = await matchesRes.json();
        const specialData: SpecialPrediction[] = await specialRes.json();
        const leaderboardData: LeaderboardEntry[] = await leaderboardRes.json();

        setPredictions(predictionsData);
        setMatches(matchesData);
        setSpecialPredictions(specialData);
        setLeaderboard(leaderboardData);

        const pointsByName = new Map(leaderboardData.map((entry) => [entry.name, entry.totalPoints ?? entry.points]));

        const leaguesRes = await fetch("/api/leagues");
        const leagues: string[] = await leaguesRes.json();

        const summaries = await Promise.all(
          leagues.map(async (league) => {
            try {
              const membersRes = await fetch(`/api/leagues/${encodeURIComponent(league)}/members`);
              const members: Member[] = await membersRes.json();

              const ranked = members
                .map((member) => ({
                  name: member.userName,
                  points: pointsByName.get(member.userName) ?? 0,
                }))
                .sort((a, b) => b.points - a.points);

              const totalPoints = ranked.reduce((sum, m) => sum + m.points, 0);
              const averagePoints = ranked.length > 0 ? totalPoints / ranked.length : 0;

              return {
                name: league,
                memberCount: ranked.length,
                averagePoints,
                topScorer: ranked[0] ?? null,
                topMembers: ranked.slice(0, 3),
              } as LeagueSummary;
            } catch {
              return { name: league, memberCount: 0, averagePoints: 0, topScorer: null, topMembers: [] } as LeagueSummary;
            }
          })
        );

        summaries.sort((a, b) => b.averagePoints - a.averagePoints);
        setLeagueSummaries(summaries);
      } catch {
        setPredictions([]);
        setMatches([]);
        setSpecialPredictions([]);
        setLeaderboard([]);
        setLeagueSummaries([]);
      } finally {
        setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const pickCountsByMatch = useMemo(() => {
    const map = new Map<string, { home: number; draw: number; away: number; total: number }>();
    for (const prediction of predictions) {
      const current = map.get(prediction.matchId) ?? { home: 0, draw: 0, away: 0, total: 0 };
      current[prediction.prediction]++;
      current.total++;
      map.set(prediction.matchId, current);
    }
    return map;
  }, [predictions]);

  const crowdMatches = useMemo(() => {
    return matches
      .filter((m) => m.actualHome === undefined && m.actualAway === undefined && m.homeTeam && m.awayTeam)
      .map((match) => {
        const counts = pickCountsByMatch.get(match.id) ?? { home: 0, draw: 0, away: 0, total: 0 };
        return { match, counts };
      })
      .filter((m) => m.counts.total > 0)
      .sort((a, b) => b.counts.total - a.counts.total)
      .slice(0, 5);
  }, [matches, pickCountsByMatch]);

  const wcWinnerStats = useMemo(() => {
    const wcWinnerPicks = specialPredictions.filter((p) => p.type === "wcwinner");
    const total = wcWinnerPicks.length;

    const counts = new Map<string, number>();
    for (const pick of wcWinnerPicks) {
      counts.set(pick.pick, (counts.get(pick.pick) ?? 0) + 1);
    }

    const ranked = ALL_WC_TEAMS
      .map((team) => ({ team, count: counts.get(team) ?? 0 }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { ranked, total };
  }, [specialPredictions]);

  const topScorerStats = useMemo(() => {
    const topScorerPicks = specialPredictions.filter((p) => p.type === "topscorer");
    const total = topScorerPicks.length;

    const counts = new Map<string, number>();
    for (const pick of topScorerPicks) {
      counts.set(pick.pick, (counts.get(pick.pick) ?? 0) + 1);
    }

    const ranked = TOP_SCORER_OPTIONS
      .map((player) => ({ player, count: counts.get(player.id) ?? 0 }))
      .sort((a, b) => b.count - a.count);

    return { ranked, total };
  }, [specialPredictions]);

  const predictionStats = useMemo(() => {
    const totalPredictions = predictions.length;
    const uniqueUsers = new Set(predictions.map((p) => p.userName)).size;
    const matchesPredicted = new Set(predictions.map((p) => p.matchId)).size;
    const bonusPicksMade = specialPredictions.length;

    return { totalPredictions, uniqueUsers, matchesPredicted, bonusPicksMade };
  }, [predictions, specialPredictions]);

  const boldPicks = useMemo(() => {
    return matches
      .filter((m) => m.actualHome === undefined && m.actualAway === undefined && m.homeTeam && m.awayTeam)
      .map((match) => {
        const counts = pickCountsByMatch.get(match.id) ?? { home: 0, draw: 0, away: 0, total: 0 };
        if (counts.total === 0) return null;

        const homeRank = FIFA_RANKINGS[match.homeTeam];
        const awayRank = FIFA_RANKINGS[match.awayTeam];
        if (!homeRank || !awayRank) return null;

        const majority: "home" | "draw" | "away" =
          counts.home >= counts.draw && counts.home >= counts.away
            ? "home"
            : counts.draw >= counts.away
              ? "draw"
              : "away";

        if (majority === "draw") return null;

        const underdog = majority === "home" ? match.homeTeam : match.awayTeam;
        const favorite = majority === "home" ? match.awayTeam : match.homeTeam;
        const underdogRank = majority === "home" ? homeRank : awayRank;
        const favoriteRank = majority === "home" ? awayRank : homeRank;

        if (underdogRank <= favoriteRank) return null;

        const rankGap = underdogRank - favoriteRank;
        const pickCount = majority === "home" ? counts.home : counts.away;
        const percentage = Math.round((pickCount / counts.total) * 100);

        return { match, underdog, favorite, underdogRank, favoriteRank, rankGap, percentage };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((a, b) => b.rankGap - a.rankGap)
      .slice(0, 5);
  }, [matches, pickCountsByMatch]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-[family-name:var(--font-heading)] text-4xl tracking-wide text-[#FFD700]">
        📊 ED&A Tournament Analytics
      </h1>
      <p className="mt-1 text-sm text-[#94a3b8]">Powered by Citizens Financial Group</p>

      {loading ? (
        <p className="mt-8 text-sm text-[#94a3b8]">Loading analytics...</p>
      ) : (
        <>
          <section className="mt-10">
            <h2 className="mb-4 font-[family-name:var(--font-heading)] text-2xl tracking-wide text-[#FFD700]">
              🌍 Crowd Win Probability
            </h2>

            {crowdMatches.length === 0 ? (
              <p className="text-sm text-[#94a3b8]">No predictions yet for upcoming matches.</p>
            ) : (
              <div className="space-y-4">
                {crowdMatches.map(({ match, counts }) => {
                  const homePct = Math.round((counts.home / counts.total) * 100);
                  const drawPct = Math.round((counts.draw / counts.total) * 100);
                  const awayPct = 100 - homePct - drawPct;

                  const majority: "home" | "draw" | "away" =
                    counts.home >= counts.draw && counts.home >= counts.away
                      ? "home"
                      : counts.draw >= counts.away
                        ? "draw"
                        : "away";

                  const majorityTeam = majority === "home" ? match.homeTeam : majority === "away" ? match.awayTeam : null;
                  const majorityPct = majority === "home" ? homePct : majority === "away" ? awayPct : drawPct;

                  return (
                    <div key={match.id} className="rounded-lg border border-[#00573F] bg-[#002820] p-4">
                      <p className="mb-2 text-sm text-white">
                        The crowd thinks:{" "}
                        {majorityTeam ? (
                          <span className="font-semibold text-[#FFD700]">
                            {getFlag(majorityTeam)} {majorityTeam} wins ({majorityPct}%)
                          </span>
                        ) : (
                          <span className="font-semibold text-[#FFD700]">🤝 Draw ({majorityPct}%)</span>
                        )}
                      </p>

                      <div className="flex items-center justify-between gap-2 text-sm text-white">
                        <span>{getFlag(match.homeTeam)} {match.homeTeam}</span>
                        <span className="text-xs text-[#94a3b8]">{counts.total} picks</span>
                        <span>{match.awayTeam} {getFlag(match.awayTeam)}</span>
                      </div>

                      <div className="mt-2">
                        <PickBar homePct={homePct} drawPct={drawPct} awayPct={awayPct} />
                      </div>

                      <div className="mt-1 flex justify-between text-xs text-[#94a3b8]">
                        <span>{homePct}% Home</span>
                        <span>{drawPct}% Draw</span>
                        <span>{awayPct}% Away</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="mt-10">
            <h2 className="mb-4 font-[family-name:var(--font-heading)] text-2xl tracking-wide text-[#FFD700]">
              🏆 Who Will Win the World Cup? (User Consensus)
            </h2>

            {wcWinnerStats.ranked.length === 0 ? (
              <p className="text-sm text-[#94a3b8]">No World Cup winner picks yet.</p>
            ) : (
              <div className="space-y-3">
                {wcWinnerStats.ranked.map((entry, index) => {
                  const pct = wcWinnerStats.total > 0 ? Math.round((entry.count / wcWinnerStats.total) * 100) : 0;
                  return (
                    <div key={entry.team} className="rounded-lg border border-[#00573F] bg-[#002820] p-4">
                      <div className="flex items-center justify-between text-sm text-white">
                        <span className="flex items-center gap-2">
                          <span className="w-6 text-center font-bold text-[#FFD700]">{index + 1}</span>
                          <span className="text-2xl">{getFlag(entry.team)}</span>
                          <span className="font-semibold">{entry.team}</span>
                          <span className="rounded bg-[#001a13] px-1 py-0.5 text-[9px] font-semibold text-[#94a3b8]">
                            #{FIFA_RANKINGS[entry.team] ?? "-"}
                          </span>
                        </span>
                        <span className="text-[#94a3b8]">
                          {entry.count} pick{entry.count === 1 ? "" : "s"} ({pct}%)
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#001a13]">
                        <div className="h-full bg-[#00A651]" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-[#94a3b8]">
                        {entry.count} out of {wcWinnerStats.total} user{wcWinnerStats.total === 1 ? "" : "s"} have made this pick
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="mt-10">
            <h2 className="mb-4 font-[family-name:var(--font-heading)] text-2xl tracking-wide text-[#FFD700]">
              🥅 Golden Boot Consensus
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {topScorerStats.ranked.map((entry) => {
                const pct = topScorerStats.total > 0 ? Math.round((entry.count / topScorerStats.total) * 100) : 0;
                return (
                  <div key={entry.player.id} className="rounded-lg border border-[#00573F] bg-[#002820] p-4 text-center">
                    <div className="text-5xl">{entry.player.flag}</div>
                    <div className="mt-2 font-[family-name:var(--font-heading)] text-lg font-bold tracking-wide text-white">
                      {entry.player.name}
                    </div>
                    <div className="mt-1 text-sm text-[#94a3b8]">{entry.player.team}</div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#001a13]">
                      <div className="h-full bg-[#00A651]" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-[#94a3b8]">
                      {entry.count} pick{entry.count === 1 ? "" : "s"} ({pct}%)
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-10">
            <h2 className="mb-4 font-[family-name:var(--font-heading)] text-2xl tracking-wide text-[#FFD700]">
              📈 Prediction Stats
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-[#00573F] bg-[#002820] p-4 text-center">
                <div className="text-xs uppercase tracking-wide text-[#94a3b8]">Total Predictions Made</div>
                <div className="mt-1 text-4xl font-bold text-[#FFD700]">{predictionStats.totalPredictions}</div>
              </div>
              <div className="rounded-lg border border-[#00573F] bg-[#002820] p-4 text-center">
                <div className="text-xs uppercase tracking-wide text-[#94a3b8]">Users Participating</div>
                <div className="mt-1 text-4xl font-bold text-[#FFD700]">{predictionStats.uniqueUsers}</div>
              </div>
              <div className="rounded-lg border border-[#00573F] bg-[#002820] p-4 text-center">
                <div className="text-xs uppercase tracking-wide text-[#94a3b8]">Matches Predicted</div>
                <div className="mt-1 text-4xl font-bold text-[#FFD700]">{predictionStats.matchesPredicted}</div>
              </div>
              <div className="rounded-lg border border-[#00573F] bg-[#002820] p-4 text-center">
                <div className="text-xs uppercase tracking-wide text-[#94a3b8]">Bonus Picks Made</div>
                <div className="mt-1 text-4xl font-bold text-[#FFD700]">{predictionStats.bonusPicksMade}</div>
              </div>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="mb-4 font-[family-name:var(--font-heading)] text-2xl tracking-wide text-[#FFD700]">
              ⚡ League Battle
            </h2>

            {leagueSummaries.length === 0 ? (
              <p className="text-sm text-[#94a3b8]">No leagues found.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {leagueSummaries.map((league) => (
                  <div key={league.name} className="rounded-lg border border-[#00573F] bg-[#002820] p-4">
                    <h3 className="font-[family-name:var(--font-heading)] text-lg tracking-wide text-[#FFD700]">
                      {league.name}
                    </h3>
                    <p className="mt-1 text-sm text-[#94a3b8]">
                      {league.memberCount} member{league.memberCount === 1 ? "" : "s"} · avg{" "}
                      {league.averagePoints.toFixed(1)} pts
                    </p>
                    {league.topScorer && (
                      <p className="mt-1 text-sm text-white">
                        Top: <span className="font-semibold">{league.topScorer.name}</span>{" "}
                        <span className="text-[#FFD700]">({league.topScorer.points} pts)</span>
                      </p>
                    )}

                    {league.topMembers.length > 0 && (
                      <ul className="mt-3 space-y-1 border-t border-[#00573F] pt-2 text-xs text-white">
                        {league.topMembers.map((member, index) => (
                          <li key={member.name} className="flex justify-between">
                            <span>
                              {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"} {member.name}
                            </span>
                            <span className="text-[#FFD700]">{member.points} pts</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-10">
            <h2 className="mb-4 font-[family-name:var(--font-heading)] text-2xl tracking-wide text-[#FFD700]">
              🎯 Bold Picks — Biggest Upsets Predicted
            </h2>

            {boldPicks.length === 0 ? (
              <p className="text-sm text-[#94a3b8]">No upset picks found.</p>
            ) : (
              <div className="space-y-3">
                {boldPicks.map(({ match, underdog, favorite, underdogRank, favoriteRank, percentage }) => (
                  <div key={match.id} className="rounded-lg border border-[#00573F] bg-[#002820] p-4 text-sm text-white">
                    {percentage}% of users think{" "}
                    <span className="font-semibold text-[#FFD700]">
                      #{underdogRank} {getFlag(underdog)} {underdog}
                    </span>{" "}
                    can upset{" "}
                    <span className="font-semibold text-[#FFD700]">
                      #{favoriteRank} {getFlag(favorite)} {favorite}
                    </span>
                    !
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
