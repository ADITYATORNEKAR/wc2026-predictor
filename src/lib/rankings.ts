// Actual FIFA Global Rankings — June 2026
// Source: ESPN / FIFA (updated June 11, 2026)
// These are GLOBAL ranks, not relative ranks among the 48 WC teams
export const FIFA_RANKINGS: Record<string, number> = {
  // Top 10 globally
  'Argentina': 1,
  'Spain': 2,
  'France': 3,
  'England': 4,
  'Portugal': 5,
  'Brazil': 6,
  'Morocco': 7,
  'Netherlands': 8,
  'Belgium': 9,
  'Germany': 10,

  // 11–20
  'Croatia': 11,
  'Colombia': 13,
  'Mexico': 14,
  'Senegal': 15,
  'Uruguay': 16,
  'United States': 17,
  'Japan': 18,
  'Switzerland': 19,
  'Iran': 20,

  // 21–35
  'Turkey': 22,
  'Ecuador': 23,
  'Austria': 24,
  'South Korea': 25,
  'Australia': 27,
  'Algeria': 28,
  'Egypt': 29,
  'Canada': 30,
  'Norway': 31,
  'Ivory Coast': 33,
  'Panama': 34,

  // 36–55
  'Sweden': 38,
  'Czechia': 40,
  'Paraguay': 41,
  'Scotland': 42,
  'Tunisia': 45,
  'DR Congo': 46,
  'Uzbekistan': 50,

  // 56–90 (lower-ranked WC qualifiers)
  'Qatar': 56,
  'Iraq': 57,
  'South Africa': 60,
  'Saudi Arabia': 61,
  'Jordan': 63,
  'Bosnia and Herzegovina': 64,
  'Cape Verde': 67,
  'Ghana': 73,
  'Curaçao': 82,
  'Haiti': 83,
  'New Zealand': 85,
};

// Aliases to handle different team name spellings across the app
export const RANKING_ALIASES: Record<string, string> = {
  'USA': 'United States',
  'Curacao': 'Curaçao',
  'Bosnia': 'Bosnia and Herzegovina',
  'Turkiye': 'Turkey',
  'Türkiye': 'Turkey',
  'Korea Republic': 'South Korea',
  'Republic of Korea': 'South Korea',
  'Côte d\'Ivoire': 'Ivory Coast',
  'Cote d\'Ivoire': 'Ivory Coast',
  'Congo DR': 'DR Congo',
  'Democratic Republic of Congo': 'DR Congo',
};

export function getTeamRank(team: string): number | undefined {
  return FIFA_RANKINGS[team] ?? FIFA_RANKINGS[RANKING_ALIASES[team] ?? ''];
}

export function getRankBadge(team: string): string {
  const rank = getTeamRank(team);
  if (!rank) return '';
  if (rank <= 10) return '🟢';
  if (rank <= 30) return '🔵';
  if (rank <= 60) return '🟡';
  return '🔴';
}

export function getRankDisplay(team: string): string {
  const rank = getTeamRank(team);
  if (!rank) return '';
  return `#${rank}`;
}
