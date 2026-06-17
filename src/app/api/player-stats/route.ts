import { NextResponse } from "next/server";

export const revalidate = 300;

const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
const ESPN_SUMMARY_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary";

const START_DATE = "2026-06-11";
const END_DATE = "2026-07-20";
const BATCH_SIZE = 5;

interface PlayerStats {
  goals: number;
  matches: number;
}

function getDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);

  while (current <= last) {
    const year = current.getUTCFullYear();
    const month = String(current.getUTCMonth() + 1).padStart(2, "0");
    const day = String(current.getUTCDate()).padStart(2, "0");
    dates.push(`${year}${month}${day}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

function getStatValue(
  stats: { name: string; value?: number; displayValue?: string }[],
  name: string
): number {
  if (!Array.isArray(stats)) return 0;
  const stat = stats.find((s) => s.name === name);
  if (!stat) return 0;
  return Number(stat.value ?? stat.displayValue ?? 0);
}

async function fetchCompletedEventIds(): Promise<string[]> {
  const today = new Date().toISOString().slice(0, 10);
  const effectiveEnd = today < END_DATE ? today : END_DATE;
  const dates = getDateRange(START_DATE, effectiveEnd);
  const eventIds: string[] = [];

  for (let i = 0; i < dates.length; i += BATCH_SIZE) {
    const batch = dates.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (date) => {
        try {
          const res = await fetch(`${ESPN_SCOREBOARD_URL}?dates=${date}`);
          if (!res.ok) return [];
          const data = await res.json();
          return ((data.events as { id: string; status: { type: { completed: boolean } } }[]) ?? [])
            .filter((e) => e.status?.type?.completed)
            .map((e) => e.id);
        } catch {
          return [];
        }
      })
    );
    for (const ids of results) eventIds.push(...ids);
  }

  return eventIds;
}

async function fetchMatchPlayerStats(
  eventId: string
): Promise<Map<string, PlayerStats>> {
  try {
    const res = await fetch(`${ESPN_SUMMARY_URL}?event=${eventId}`);
    if (!res.ok) return new Map();

    const data = await res.json();
    const playerMap = new Map<string, PlayerStats>();
    const rosters =
      (data.rosters as {
        roster: {
          athlete: { displayName?: string; fullName?: string };
          stats: { name: string; value?: number; displayValue?: string }[];
        }[];
      }[]) ?? [];

    for (const team of rosters) {
      for (const entry of team.roster ?? []) {
        const name =
          entry.athlete?.displayName ?? entry.athlete?.fullName;
        if (!name) continue;

        const appearances = getStatValue(entry.stats ?? [], "appearances");
        if (appearances < 1) continue;

        const goals = getStatValue(entry.stats ?? [], "totalGoals");
        const key = name.toLowerCase();

        const existing = playerMap.get(key) ?? { goals: 0, matches: 0 };
        existing.goals += goals;
        existing.matches += 1;
        playerMap.set(key, existing);
      }
    }

    return playerMap;
  } catch {
    return new Map();
  }
}

export async function GET() {
  try {
    const eventIds = await fetchCompletedEventIds();
    const aggregated: Record<string, PlayerStats> = {};

    for (let i = 0; i < eventIds.length; i += BATCH_SIZE) {
      const batch = eventIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(fetchMatchPlayerStats));

      for (const matchMap of results) {
        for (const [name, stats] of matchMap) {
          if (!aggregated[name]) {
            aggregated[name] = { goals: 0, matches: 0 };
          }
          aggregated[name].goals += stats.goals;
          aggregated[name].matches += stats.matches;
        }
      }
    }

    return NextResponse.json(aggregated);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch player stats",
      },
      { status: 500 }
    );
  }
}
