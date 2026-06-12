"use client";

import { useEffect, useMemo, useState } from "react";
import { Match } from "@/lib/types";
import { MappedMatch } from "@/lib/espn";
import { getFlag } from "@/lib/flags";
import { FIFA_RANKINGS } from "@/lib/rankings";

const POLL_INTERVAL_MS = 60000;
const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

interface TeamStats {
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

interface Result {
  homeScore: number;
  awayScore: number;
}

export default function StandingsPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [liveMatches, setLiveMatches] = useState<MappedMatch[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    const load = () => {
      Promise.all([
        fetch("/api/matches").then((res) => res.json()),
        fetch("/api/livescores").then((res) => res.json()),
      ])
        .then(([matchesData, liveData]) => {
          setMatches(matchesData ?? []);
          setLiveMatches(liveData.matches ?? []);
          setLastUpdated(new Date());
        })
        .catch(() => {
          setMatches([]);
          setLiveMatches([]);
        });
    };

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!lastUpdated) return;

    const tick = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);

    setSecondsAgo(0);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  const resultsByTeams = useMemo(() => {
    const map = new Map<string, Result>();
    for (const liveMatch of liveMatches) {
      if (liveMatch.status !== "finished" || liveMatch.homeScore === null || liveMatch.awayScore === null) {
        continue;
      }
      map.set(`${liveMatch.homeTeam}__${liveMatch.awayTeam}`, {
        homeScore: liveMatch.homeScore,
        awayScore: liveMatch.awayScore,
      });
    }
    return map;
  }, [liveMatches]);

  const groupData = useMemo(() => {
    return GROUPS.map((group) => {
      const groupMatches = matches.filter((m) => m.group === group);

      const teams = new Map<string, TeamStats>();
      const ensureTeam = (team: string) => {
        if (!teams.has(team)) {
          teams.set(team, {
            team,
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
          });
        }
        return teams.get(team)!;
      };

      let finishedCount = 0;

      for (const match of groupMatches) {
        ensureTeam(match.homeTeam);
        ensureTeam(match.awayTeam);

        let result: Result | undefined;
        if (match.actualHome !== undefined && match.actualAway !== undefined) {
          result = { homeScore: match.actualHome, awayScore: match.actualAway };
        } else {
          result = resultsByTeams.get(`${match.homeTeam}__${match.awayTeam}`);
        }

        if (!result) continue;

        finishedCount++;

        const home = ensureTeam(match.homeTeam);
        const away = ensureTeam(match.awayTeam);

        home.played++;
        away.played++;
        home.goalsFor += result.homeScore;
        home.goalsAgainst += result.awayScore;
        away.goalsFor += result.awayScore;
        away.goalsAgainst += result.homeScore;

        if (result.homeScore > result.awayScore) {
          home.wins++;
          away.losses++;
        } else if (result.homeScore < result.awayScore) {
          away.wins++;
          home.losses++;
        } else {
          home.draws++;
          away.draws++;
        }
      }

      const sorted = Array.from(teams.values()).sort((a, b) => {
        const aPts = a.wins * 3 + a.draws;
        const bPts = b.wins * 3 + b.draws;
        if (bPts !== aPts) return bPts - aPts;

        const aGd = a.goalsFor - a.goalsAgainst;
        const bGd = b.goalsFor - b.goalsAgainst;
        if (bGd !== aGd) return bGd - aGd;

        return b.goalsFor - a.goalsFor;
      });

      const isComplete = groupMatches.length > 0 && finishedCount === groupMatches.length;

      return { group, teams: sorted, isComplete };
    });
  }, [matches, resultsByTeams]);

  return (
    <div className="mx-auto max-w-6xl bg-[#003B2B] px-4 py-8">
      <h1 className="mb-2 font-[family-name:var(--font-heading)] text-4xl tracking-wide text-[#FFD700]">
        Group Standings
      </h1>

      {lastUpdated && (
        <p className="mb-6 text-xs text-[#94a3b8]">
          Last updated: {secondsAgo} second{secondsAgo === 1 ? "" : "s"} ago
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {groupData.map(({ group, teams, isComplete }) => (
          <div key={group} className="overflow-hidden rounded-lg border border-[#00573F] bg-[#002820]">
            <div className="bg-[#00573F] px-3 py-2 font-[family-name:var(--font-heading)] text-lg tracking-wide text-[#FFD700]">
              GROUP {group}
            </div>
            <table className="w-full text-xs text-white">
              <thead>
                <tr className="border-b border-[#00573F] text-[#94a3b8]">
                  <th className="px-2 py-1 text-left">#</th>
                  <th className="px-2 py-1 text-left">Team</th>
                  <th className="px-1 py-1 text-center">FIFA</th>
                  <th className="px-1 py-1 text-center">P</th>
                  <th className="px-1 py-1 text-center">W</th>
                  <th className="px-1 py-1 text-center">D</th>
                  <th className="px-1 py-1 text-center">L</th>
                  <th className="px-1 py-1 text-center">GF</th>
                  <th className="px-1 py-1 text-center">GA</th>
                  <th className="px-1 py-1 text-center">GD</th>
                  <th className="px-1 py-1 text-center">Pts</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team, index) => {
                  const gd = team.goalsFor - team.goalsAgainst;
                  const pts = team.wins * 3 + team.draws;
                  const position = index + 1;

                  let rowClasses = "border-b border-[#00573F]/50";
                  if (position <= 2) {
                    rowClasses += " border-l-4 border-l-[#00A651] bg-[#00A651]/10";
                  } else if (position === 3) {
                    rowClasses += " bg-[#FFD700]/10";
                  }

                  return (
                    <tr key={team.team} className={rowClasses}>
                      <td className="px-2 py-1.5">{position}</td>
                      <td className="px-2 py-1.5">
                        <span className="mr-1">{getFlag(team.team)}</span>
                        {team.team}
                        {position <= 2 && isComplete && (
                          <span className="ml-2 rounded-full bg-[#00A651] px-1.5 py-0.5 text-[10px] font-bold text-white">
                            QUALIFIED ✓
                          </span>
                        )}
                      </td>
                      <td className="px-1 py-1.5 text-center text-[#94a3b8]">
                        {FIFA_RANKINGS[team.team] ? `#${FIFA_RANKINGS[team.team]}` : "-"}
                      </td>
                      <td className="px-1 py-1.5 text-center">{team.played}</td>
                      <td className="px-1 py-1.5 text-center">{team.wins}</td>
                      <td className="px-1 py-1.5 text-center">{team.draws}</td>
                      <td className="px-1 py-1.5 text-center">{team.losses}</td>
                      <td className="px-1 py-1.5 text-center">{team.goalsFor}</td>
                      <td className="px-1 py-1.5 text-center">{team.goalsAgainst}</td>
                      <td className="px-1 py-1.5 text-center">{gd > 0 ? `+${gd}` : gd}</td>
                      <td className="px-1 py-1.5 text-center font-bold">{pts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
