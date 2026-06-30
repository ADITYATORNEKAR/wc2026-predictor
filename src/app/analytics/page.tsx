"use client";

import { useEffect, useMemo, useState } from "react";
import { SpecialPrediction } from "@/lib/types";
import { getTeamRank } from "@/lib/rankings";
import { TOP_SCORER_OPTIONS, ALL_WC_TEAMS } from "@/lib/special-picks";
import TeamFlag from "@/components/TeamFlag";

const REFRESH_INTERVAL_MS = 60000;

interface WCStats {
  matchesPlayed: number;
  totalGoals: number;
  goalsPerMatch: string;
  highestScoringMatch: {
    home: string;
    away: string;
    homeScore: number;
    awayScore: number;
  } | null;
  biggestUpset: {
    winner: string;
    loser: string;
    winnerRank: number;
    loserRank: number;
  } | null;
  knockoutBreakdown: {
    total: number;
    ninetyMins: number;
    extraTime: number;
    penalties: number;
  };
}

interface PredictionAnalytics {
  totalPredictions: number;
  usersParticipating: number;
  matchesPredicted: number;
  overallAccuracy: string;
  outcomeDistribution: { home: number; draw: number; away: number };
  hardestMatch: { home: string; away: string; correctPct: number } | null;
  hottestPredictor: { name: string; recentCorrect: number } | null;
  currentLeader: { name: string; points: number } | null;
  pointsGap: number;
}

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

function StatCardSkeleton() {
  return (
    <div className="rounded-lg border border-[#00573F] bg-[#002820] p-4 text-center">
      <div className="mx-auto h-3 w-24 animate-pulse rounded bg-white/10" />
      <div className="mx-auto mt-3 h-8 w-16 animate-pulse rounded bg-white/10" />
    </div>
  );
}

function InsightCardSkeleton() {
  return (
    <div className="rounded-lg border border-[#00573F] bg-[#002820] p-5">
      <div className="h-3 w-28 animate-pulse rounded bg-white/10" />
      <div className="mt-3 h-6 w-40 animate-pulse rounded bg-white/10" />
      <div className="mt-2 h-3 w-32 animate-pulse rounded bg-white/10" />
    </div>
  );
}

export default function AnalyticsPage() {
  const [wcStats, setWcStats] = useState<WCStats | null>(null);
  const [predAnalytics, setPredAnalytics] = useState<PredictionAnalytics | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [specialPredictions, setSpecialPredictions] = useState<SpecialPrediction[]>([]);
  const [leagueSummaries, setLeagueSummaries] = useState<LeagueSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/world-cup-stats").then((r) => r.json()),
      fetch("/api/prediction-analytics").then((r) => r.json()),
    ])
      .then(([wcData, predData]) => {
        if (!wcData.error) setWcStats(wcData);
        if (!predData.error) setPredAnalytics(predData);
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));

    const load = async () => {
      try {
        const [specialRes, leaderboardRes] = await Promise.all([
          fetch("/api/special-predictions"),
          fetch("/api/leaderboard"),
        ]);

        const specialData: SpecialPrediction[] = await specialRes.json();
        const leaderboardData: LeaderboardEntry[] = await leaderboardRes.json();
        setSpecialPredictions(specialData);

        const pointsByName = new Map(
          leaderboardData.map((entry) => [entry.name, entry.totalPoints ?? entry.points])
        );

        const leaguesRes = await fetch("/api/leagues");
        const leagues: string[] = await leaguesRes.json();

        const summaries = await Promise.all(
          leagues.map(async (league) => {
            try {
              const membersRes = await fetch(
                `/api/leagues/${encodeURIComponent(league)}/members`
              );
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
              return {
                name: league,
                memberCount: 0,
                averagePoints: 0,
                topScorer: null,
                topMembers: [],
              } as LeagueSummary;
            }
          })
        );

        summaries.sort((a, b) => b.averagePoints - a.averagePoints);
        setLeagueSummaries(summaries);
      } catch {
        setSpecialPredictions([]);
        setLeagueSummaries([]);
      } finally {
        setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

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

  const bonusPicksMade = specialPredictions.length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-[family-name:var(--font-heading)] text-4xl tracking-wide text-[#FFD700]">
        📊 ED&A Tournament Analytics
      </h1>
      <p className="mt-1 text-sm text-[#94a3b8]">Powered by Citizens Financial Group</p>

      {/* ── Section 1: Tournament Stats Banner ── */}
      <div className="mt-6 overflow-hidden rounded-xl border border-[#00573F] bg-[#002820]">
        {statsLoading ? (
          <div className="flex items-center justify-center gap-8 px-6 py-6 sm:gap-12">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="h-10 w-20 animate-pulse rounded-md bg-white/10" />
                <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
                {i < 2 && <div className="hidden sm:block" />}
              </div>
            ))}
          </div>
        ) : wcStats ? (
          <div className="flex flex-col items-center gap-4 px-6 py-6">
            <div className="flex items-center justify-center gap-6 sm:gap-12">
              <div className="flex flex-col items-center">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg">⚽</span>
                  <span className="font-[family-name:var(--font-heading)] text-4xl font-bold tracking-wide text-white sm:text-5xl">
                    {wcStats.totalGoals}
                  </span>
                </div>
                <span className="mt-1 text-sm text-[#94a3b8]">Goals Scored</span>
              </div>
              <div className="h-14 w-px bg-white/20" />
              <div className="flex flex-col items-center">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg">🏟️</span>
                  <span className="font-[family-name:var(--font-heading)] text-4xl font-bold tracking-wide text-white sm:text-5xl">
                    {wcStats.matchesPlayed}
                  </span>
                </div>
                <span className="mt-1 text-sm text-[#94a3b8]">Matches Played</span>
              </div>
              <div className="h-14 w-px bg-white/20" />
              <div className="flex flex-col items-center">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg">📊</span>
                  <span className="font-[family-name:var(--font-heading)] text-4xl font-bold tracking-wide text-white sm:text-5xl">
                    {wcStats.goalsPerMatch}
                  </span>
                </div>
                <span className="mt-1 text-sm text-[#94a3b8]">Avg Goals/Match</span>
              </div>
            </div>
            <span className="text-xs font-medium text-[#FFD700]">
              Live • updates after each match
            </span>
          </div>
        ) : null}
      </div>

      {/* ── Section 2: Prediction Stats ── */}
      <section className="mt-10">
        <h2 className="mb-4 font-[family-name:var(--font-heading)] text-2xl tracking-wide text-[#FFD700]">
          📈 Prediction Stats
        </h2>

        {statsLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
        ) : predAnalytics ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-[#00573F] bg-[#002820] p-4 text-center">
              <div className="text-xs uppercase tracking-wide text-[#94a3b8]">
                Total Predictions Made
              </div>
              <div className="mt-1 text-4xl font-bold text-[#FFD700]">
                {predAnalytics.totalPredictions}
              </div>
            </div>
            <div className="rounded-lg border border-[#00573F] bg-[#002820] p-4 text-center">
              <div className="text-xs uppercase tracking-wide text-[#94a3b8]">
                Users Participating
              </div>
              <div className="mt-1 text-4xl font-bold text-[#FFD700]">
                {predAnalytics.usersParticipating}
              </div>
            </div>
            <div className="rounded-lg border border-[#00573F] bg-[#002820] p-4 text-center">
              <div className="text-xs uppercase tracking-wide text-[#94a3b8]">
                Matches Predicted
              </div>
              <div className="mt-1 text-4xl font-bold text-[#FFD700]">
                {predAnalytics.matchesPredicted}
              </div>
            </div>
            <div className="rounded-lg border border-[#00573F] bg-[#002820] p-4 text-center">
              <div className="text-xs uppercase tracking-wide text-[#94a3b8]">
                Bonus Picks Made
              </div>
              <div className="mt-1 text-4xl font-bold text-[#FFD700]">{bonusPicksMade}</div>
            </div>
            <div className="rounded-lg border border-[#00573F] bg-[#002820] p-4 text-center">
              <div className="text-xs uppercase tracking-wide text-[#94a3b8]">
                Overall Accuracy
              </div>
              <div className="mt-1 text-4xl font-bold text-[#FFD700]">
                {predAnalytics.overallAccuracy}
              </div>
            </div>
            <div className="rounded-lg border border-[#00573F] bg-[#002820] p-4 text-center">
              <div className="text-xs uppercase tracking-wide text-[#94a3b8]">
                🥇 Current Leader
              </div>
              {predAnalytics.currentLeader ? (
                <>
                  <div className="mt-1 text-2xl font-bold text-white">
                    {predAnalytics.currentLeader.name}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-[#FFD700]">
                    {predAnalytics.currentLeader.points} pts
                  </div>
                </>
              ) : (
                <div className="mt-1 text-2xl font-bold text-[#FFD700]">—</div>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {/* ── Section 3: Match Insights ── */}
      <section className="mt-10">
        <h2 className="mb-4 font-[family-name:var(--font-heading)] text-2xl tracking-wide text-[#FFD700]">
          🔍 Match Insights
        </h2>

        {statsLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <InsightCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Highest Scoring Match */}
            <div className="rounded-lg border border-[#00573F] bg-[#002820] p-5">
              <div className="text-xs uppercase tracking-wide text-[#94a3b8]">
                Highest Scoring Match
              </div>
              {wcStats?.highestScoringMatch ? (
                <div className="mt-3">
                  <div className="flex items-center justify-center gap-3 text-lg font-bold text-white">
                    <span className="flex items-center gap-1.5">
                      <TeamFlag team={wcStats.highestScoringMatch.home} size={24} />
                      {wcStats.highestScoringMatch.home}
                    </span>
                    <span className="text-[#FFD700]">
                      {wcStats.highestScoringMatch.homeScore} – {wcStats.highestScoringMatch.awayScore}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {wcStats.highestScoringMatch.away}
                      <TeamFlag team={wcStats.highestScoringMatch.away} size={24} />
                    </span>
                  </div>
                  <p className="mt-2 text-center text-xs text-[#94a3b8]">
                    {wcStats.highestScoringMatch.homeScore + wcStats.highestScoringMatch.awayScore} total
                    goals
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-[#94a3b8]">No matches played yet</p>
              )}
            </div>

            {/* Biggest Upset */}
            <div className="rounded-lg border border-[#00573F] bg-[#002820] p-5">
              <div className="text-xs uppercase tracking-wide text-[#94a3b8]">Biggest Upset</div>
              {wcStats?.biggestUpset ? (
                <div className="mt-3">
                  <div className="flex items-center justify-center gap-3 text-lg font-bold text-white">
                    <span className="flex items-center gap-1.5">
                      <TeamFlag team={wcStats.biggestUpset.winner} size={24} />
                      {wcStats.biggestUpset.winner}
                    </span>
                    <span className="text-xs text-[#94a3b8]">beat</span>
                    <span className="flex items-center gap-1.5">
                      {wcStats.biggestUpset.loser}
                      <TeamFlag team={wcStats.biggestUpset.loser} size={24} />
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-center gap-3 text-xs">
                    <span className="rounded bg-[#003B2B] px-1.5 py-0.5 font-semibold text-[#FFD700]">
                      #{wcStats.biggestUpset.winnerRank}
                    </span>
                    <span className="text-[#94a3b8]">vs</span>
                    <span className="rounded bg-[#003B2B] px-1.5 py-0.5 font-semibold text-[#FFD700]">
                      #{wcStats.biggestUpset.loserRank}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-[#94a3b8]">No upsets yet</p>
              )}
            </div>

            {/* Hardest to Predict */}
            <div className="rounded-lg border border-[#00573F] bg-[#002820] p-5">
              <div className="text-xs uppercase tracking-wide text-[#94a3b8]">
                Hardest to Predict
              </div>
              {predAnalytics?.hardestMatch ? (
                <div className="mt-3">
                  <div className="flex items-center justify-center gap-3 text-lg font-bold text-white">
                    <span className="flex items-center gap-1.5">
                      <TeamFlag team={predAnalytics.hardestMatch.home} size={24} />
                      {predAnalytics.hardestMatch.home}
                    </span>
                    <span className="text-xs text-[#94a3b8]">vs</span>
                    <span className="flex items-center gap-1.5">
                      {predAnalytics.hardestMatch.away}
                      <TeamFlag team={predAnalytics.hardestMatch.away} size={24} />
                    </span>
                  </div>
                  <p className="mt-2 text-center text-sm font-semibold text-[#FFD700]">
                    Only {predAnalytics.hardestMatch.correctPct}% got it right
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-[#94a3b8]">No data yet</p>
              )}
            </div>

            {/* Points Gap */}
            <div className="rounded-lg border border-[#00573F] bg-[#002820] p-5">
              <div className="text-xs uppercase tracking-wide text-[#94a3b8]">Points Gap</div>
              {predAnalytics ? (
                <div className="mt-3 text-center">
                  <div className="text-4xl font-bold text-[#FFD700]">
                    {predAnalytics.pointsGap}
                  </div>
                  <p className="mt-1 text-sm text-[#94a3b8]">pts between 1st and last</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-[#94a3b8]">No data yet</p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── Section 3b: How Matches Were Decided ── */}
      {!statsLoading && wcStats && wcStats.knockoutBreakdown.total > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-[family-name:var(--font-heading)] text-2xl tracking-wide text-[#FFD700]">
            ⏱️ How Matches Were Decided
          </h2>

          {(() => {
            const { total, ninetyMins, extraTime, penalties } = wcStats.knockoutBreakdown;
            const ftPct = Math.round((ninetyMins / total) * 100);
            const aetPct = Math.round((extraTime / total) * 100);
            const penPct = 100 - ftPct - aetPct;

            return (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-[#00A651] bg-[#002820] p-4 text-center">
                    <div className="text-xs uppercase tracking-wide text-[#94a3b8]">⚽ Full Time</div>
                    <div className="mt-1 text-4xl font-bold text-[#00A651]">{ninetyMins}</div>
                    <p className="mt-1 text-xs text-[#94a3b8]">
                      match{ninetyMins === 1 ? "" : "es"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#FFD700] bg-[#002820] p-4 text-center">
                    <div className="text-xs uppercase tracking-wide text-[#94a3b8]">⏰ Extra Time</div>
                    <div className="mt-1 text-4xl font-bold text-[#FFD700]">{extraTime}</div>
                    <p className="mt-1 text-xs text-[#94a3b8]">
                      match{extraTime === 1 ? "" : "es"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-orange-500 bg-[#002820] p-4 text-center">
                    <div className="text-xs uppercase tracking-wide text-[#94a3b8]">🎯 Penalties</div>
                    <div className="mt-1 text-4xl font-bold text-orange-500">{penalties}</div>
                    <p className="mt-1 text-xs text-[#94a3b8]">
                      match{penalties === 1 ? "" : "es"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-[#00573F] bg-[#002820] p-4">
                  <div className="flex h-6 w-full overflow-hidden rounded-full bg-[#001a13]">
                    {ninetyMins > 0 && (
                      <div
                        className="flex items-center justify-center bg-[#00A651] text-[10px] font-semibold text-white"
                        style={{ width: `${ftPct}%` }}
                      >
                        {ftPct >= 10 ? `${ftPct}%` : ""}
                      </div>
                    )}
                    {extraTime > 0 && (
                      <div
                        className="flex items-center justify-center bg-[#FFD700] text-[10px] font-semibold text-[#002820]"
                        style={{ width: `${aetPct}%` }}
                      >
                        {aetPct >= 10 ? `${aetPct}%` : ""}
                      </div>
                    )}
                    {penalties > 0 && (
                      <div
                        className="flex items-center justify-center bg-orange-500 text-[10px] font-semibold text-white"
                        style={{ width: `${penPct}%` }}
                      >
                        {penPct >= 10 ? `${penPct}%` : ""}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] text-[#94a3b8]">
                    <span>⚽ FT {ftPct}%</span>
                    <span>⏰ AET {aetPct}%</span>
                    <span>🎯 PEN {penPct}%</span>
                  </div>
                </div>
              </>
            );
          })()}
        </section>
      )}

      {/* ── Section 4: Prediction Breakdown ── */}
      <section className="mt-10">
        <h2 className="mb-4 font-[family-name:var(--font-heading)] text-2xl tracking-wide text-[#FFD700]">
          📊 Prediction Breakdown
        </h2>

        {statsLoading ? (
          <div className="space-y-4 rounded-lg border border-[#00573F] bg-[#002820] p-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-white/10" />
            ))}
          </div>
        ) : predAnalytics ? (
          <div className="space-y-4 rounded-lg border border-[#00573F] bg-[#002820] p-5">
            {/* Home */}
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-semibold text-white">🏠 Home Win</span>
                <span className="font-bold text-[#00A651]">
                  {predAnalytics.outcomeDistribution.home}%
                </span>
              </div>
              <div className="h-5 w-full overflow-hidden rounded-full bg-[#001a13]">
                <div
                  className="h-full rounded-full bg-[#00A651] transition-all duration-500"
                  style={{ width: `${predAnalytics.outcomeDistribution.home}%` }}
                />
              </div>
            </div>
            {/* Draw */}
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-semibold text-white">🤝 Draw</span>
                <span className="font-bold text-[#94a3b8]">
                  {predAnalytics.outcomeDistribution.draw}%
                </span>
              </div>
              <div className="h-5 w-full overflow-hidden rounded-full bg-[#001a13]">
                <div
                  className="h-full rounded-full bg-[#64748b] transition-all duration-500"
                  style={{ width: `${predAnalytics.outcomeDistribution.draw}%` }}
                />
              </div>
            </div>
            {/* Away */}
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-semibold text-white">✈️ Away Win</span>
                <span className="font-bold text-[#FFD700]">
                  {predAnalytics.outcomeDistribution.away}%
                </span>
              </div>
              <div className="h-5 w-full overflow-hidden rounded-full bg-[#001a13]">
                <div
                  className="h-full rounded-full bg-[#FFD700] transition-all duration-500"
                  style={{ width: `${predAnalytics.outcomeDistribution.away}%` }}
                />
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* ── Section 5: Hottest Predictor ── */}
      <section className="mt-10">
        <h2 className="mb-4 font-[family-name:var(--font-heading)] text-2xl tracking-wide text-[#FFD700]">
          🔥 Hottest Predictor
        </h2>

        {statsLoading ? (
          <div className="rounded-lg border border-[#00573F] bg-[#002820] p-5">
            <div className="h-6 w-64 animate-pulse rounded bg-white/10" />
          </div>
        ) : predAnalytics?.hottestPredictor ? (
          <div className="rounded-lg border border-[#FFD700]/30 bg-[#002820] p-5">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔥</span>
              <div>
                <div className="text-lg font-bold text-white">
                  On Fire: {predAnalytics.hottestPredictor.name}
                </div>
                <div className="text-sm text-[#FFD700]">
                  {predAnalytics.hottestPredictor.recentCorrect}/5 correct in last 5 matches
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-[#00573F] bg-[#002820] p-5">
            <p className="text-sm text-[#94a3b8]">Not enough data yet</p>
          </div>
        )}
      </section>

      {/* ── Section 6: League Battle (existing) ── */}
      <section className="mt-10">
        <h2 className="mb-4 font-[family-name:var(--font-heading)] text-2xl tracking-wide text-[#FFD700]">
          ⚡ League Battle
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-lg border border-[#00573F] bg-[#002820] p-4">
                <div className="h-5 w-24 animate-pulse rounded bg-white/10" />
                <div className="mt-3 h-3 w-32 animate-pulse rounded bg-white/10" />
                <div className="mt-2 h-3 w-28 animate-pulse rounded bg-white/10" />
              </div>
            ))}
          </div>
        ) : leagueSummaries.length === 0 ? (
          <p className="text-sm text-[#94a3b8]">No leagues found.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {leagueSummaries.map((league) => (
              <div
                key={league.name}
                className="rounded-lg border border-[#00573F] bg-[#002820] p-4"
              >
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

      {/* ── Section 7: WC Winner Consensus (existing) ── */}
      <section className="mt-10">
        <h2 className="mb-4 font-[family-name:var(--font-heading)] text-2xl tracking-wide text-[#FFD700]">
          🏆 Who Will Win the World Cup? (User Consensus)
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-lg border border-[#00573F] bg-[#002820] p-4">
                <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
                <div className="mt-3 h-2 w-full animate-pulse rounded-full bg-white/10" />
              </div>
            ))}
          </div>
        ) : wcWinnerStats.ranked.length === 0 ? (
          <p className="text-sm text-[#94a3b8]">No World Cup winner picks yet.</p>
        ) : (
          <div className="space-y-3">
            {wcWinnerStats.ranked.map((entry, index) => {
              const pct =
                wcWinnerStats.total > 0
                  ? Math.round((entry.count / wcWinnerStats.total) * 100)
                  : 0;
              return (
                <div
                  key={entry.team}
                  className="rounded-lg border border-[#00573F] bg-[#002820] p-4"
                >
                  <div className="flex items-center justify-between text-sm text-white">
                    <span className="flex items-center gap-2">
                      <span className="w-6 text-center font-bold text-[#FFD700]">
                        {index + 1}
                      </span>
                      <TeamFlag team={entry.team} size={20} />
                      <span className="font-semibold">{entry.team}</span>
                      <span className="rounded bg-[#001a13] px-1 py-0.5 text-[9px] font-semibold text-[#94a3b8]">
                        #{getTeamRank(entry.team) ?? "-"}
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
                    {entry.count} out of {wcWinnerStats.total} user
                    {wcWinnerStats.total === 1 ? "" : "s"} have made this pick
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Section 8: Golden Boot Consensus (existing) ── */}
      <section className="mt-10">
        <h2 className="mb-4 font-[family-name:var(--font-heading)] text-2xl tracking-wide text-[#FFD700]">
          🥅 Golden Boot Consensus
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-[#00573F] bg-[#002820] p-4 text-center"
              >
                <div className="mx-auto h-5 w-5 animate-pulse rounded-full bg-white/10" />
                <div className="mx-auto mt-3 h-4 w-20 animate-pulse rounded bg-white/10" />
                <div className="mx-auto mt-2 h-3 w-16 animate-pulse rounded bg-white/10" />
                <div className="mx-auto mt-3 h-2 w-full animate-pulse rounded-full bg-white/10" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {topScorerStats.ranked.map((entry) => {
              const pct =
                topScorerStats.total > 0
                  ? Math.round((entry.count / topScorerStats.total) * 100)
                  : 0;
              return (
                <div
                  key={entry.player.id}
                  className="rounded-lg border border-[#00573F] bg-[#002820] p-4 text-center"
                >
                  <div className="flex justify-center">
                    <TeamFlag team={entry.player.team} size={20} />
                  </div>
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
        )}
      </section>
    </div>
  );
}
