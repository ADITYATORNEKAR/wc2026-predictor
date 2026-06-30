const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

const START_DATE = "2026-06-11";
const END_DATE = "2026-06-28";
const BATCH_SIZE = 5;

export const ESPN_NAME_MAP: Record<string, string> = {
  "South Korea": "South Korea",
  "Korea Republic": "South Korea",
  "Turkey": "Türkiye",
  "Côte d'Ivoire": "Ivory Coast",
  "Cote d'Ivoire": "Ivory Coast",
  "Ivory Coast": "Ivory Coast",
  "Bosnia and Herzegovina": "Bosnia and Herzegovina",
  "Bosnia-Herzegovina": "Bosnia and Herzegovina",
  "Bosnia & Herzegovina": "Bosnia and Herzegovina",
  "Cape Verde": "Cabo Verde",
  "Democratic Republic of Congo": "DR Congo",
  "DR Congo": "DR Congo",
  "Congo DR": "DR Congo",
  "Congo, DR": "DR Congo",
  "United States": "USA",
  "USA": "USA",
  "Germany": "Germany",
  "Paraguay": "Paraguay",
  "Netherlands": "Netherlands",
  "Morocco": "Morocco",
  "Brazil": "Brazil",
  "Japan": "Japan",
};

export type MatchStatus = "upcoming" | "live" | "halftime" | "finished";

export type EndedType = "FT" | "AET" | "PEN";

export interface MappedMatch {
  espnId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  displayClock: string;
  period: number;
  winner: "home" | "away" | null;
  endedType: EndedType;
  homeShootout: number | null;
  awayShootout: number | null;
}

interface EspnCompetitor {
  homeAway: "home" | "away";
  team: { displayName: string; abbreviation: string };
  score: string;
  winner?: boolean;
  shootoutScore?: number;
}

interface EspnEvent {
  id: string;
  name: string;
  status: {
    type: {
      name: string;
      shortDetail: string;
      completed: boolean;
    };
    clock: number;
    displayClock: string;
    period: number;
  };
  competitions: {
    competitors: EspnCompetitor[];
  }[];
}

interface EspnScoreboardResponse {
  events?: EspnEvent[];
}

export function normalizeTeamName(name: string): string {
  return ESPN_NAME_MAP[name] ?? name;
}

function mapStatus(statusName: string): MatchStatus {
  switch (statusName) {
    case "STATUS_IN_PROGRESS":
    case "STATUS_FIRST_HALF":
    case "STATUS_SECOND_HALF":
    case "STATUS_FIRST_HALF_EXTRA":
    case "STATUS_SECOND_HALF_EXTRA":
    case "STATUS_END_EXTRA_TIME":
    case "STATUS_PENALTY_SHOOTOUT":
      return "live";
    case "STATUS_HALFTIME":
    case "STATUS_HALFTIME_EXTRA":
      return "halftime";
    case "STATUS_FINAL":
    case "STATUS_FULL_TIME":
    case "STATUS_FINAL_PEN":
    case "STATUS_FINAL_AET":
      return "finished";
    case "STATUS_SCHEDULED":
    case "STATUS_TIMED":
    default:
      return "upcoming";
  }
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

async function fetchScoreboard(date: string): Promise<EspnEvent[]> {
  const response = await fetch(`${ESPN_SCOREBOARD_URL}?dates=${date}`);

  if (!response.ok) {
    throw new Error(`ESPN request failed for date ${date}: ${response.status}`);
  }

  const data: EspnScoreboardResponse = await response.json();
  return data.events ?? [];
}

function mapEvent(event: EspnEvent): MappedMatch | null {
  const competitors = event.competitions?.[0]?.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");

  if (!home || !away) return null;

  const status = event.status.type.name;
  const isUpcoming = status === "STATUS_SCHEDULED" || status === "STATUS_TIMED";

  const winner = home.winner ? "home" : away.winner ? "away" : null;

  const endedType: EndedType =
    status === "STATUS_FINAL_PEN" ? "PEN" : status === "STATUS_FINAL_AET" ? "AET" : "FT";

  return {
    espnId: event.id,
    homeTeam: normalizeTeamName(home.team.displayName),
    awayTeam: normalizeTeamName(away.team.displayName),
    homeScore: isUpcoming ? null : Number(home.score),
    awayScore: isUpcoming ? null : Number(away.score),
    status: mapStatus(status),
    displayClock: event.status.type.shortDetail,
    period: event.status.period,
    winner,
    endedType,
    homeShootout: home.shootoutScore ?? null,
    awayShootout: away.shootoutScore ?? null,
  };
}

export async function fetchAllMatches(start: string = START_DATE, end: string = END_DATE): Promise<MappedMatch[]> {
  const dates = getDateRange(start, end);
  const allEvents: EspnEvent[] = [];

  for (let i = 0; i < dates.length; i += BATCH_SIZE) {
    const batch = dates.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((date) => fetchScoreboard(date)));
    results.forEach((events) => allEvents.push(...events));
  }

  return allEvents.map(mapEvent).filter((match): match is MappedMatch => match !== null);
}
