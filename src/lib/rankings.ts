export const FIFA_RANKINGS: Record<string, number> = {
  'Argentina': 1, 'Spain': 2, 'France': 3, 'England': 4, 'Portugal': 5,
  'Brazil': 6, 'Belgium': 7, 'Netherlands': 8, 'Germany': 9, 'Uruguay': 10,
  'Croatia': 11, 'Switzerland': 12, 'Japan': 13, 'Türkiye': 14, 'Colombia': 15,
  'Mexico': 16, 'USA': 17, 'Sweden': 18, 'South Korea': 19, 'Norway': 20,
  'Czechia': 21, 'Paraguay': 22, 'Saudi Arabia': 23, 'Bosnia and Herzegovina': 24,
  'Morocco': 25, 'Iran': 26, 'Ecuador': 27, 'Senegal': 28, 'Egypt': 29,
  'Canada': 30, 'Algeria': 31, 'Ivory Coast': 32, 'Scotland': 33, 'Austria': 34,
  'Australia': 35, 'Ghana': 36, 'South Africa': 37, 'Uzbekistan': 38,
  'Tunisia': 39, 'Cabo Verde': 40, 'DR Congo': 41, 'Panama': 42,
  'Qatar': 43, 'Haiti': 44, 'Iraq': 45, 'Curaçao': 46, 'New Zealand': 47, 'Jordan': 48,
};

export function getRankBadge(team: string): string {
  const rank = FIFA_RANKINGS[team];
  if (!rank) return '';
  if (rank <= 5) return '🔴';
  if (rank <= 15) return '🟠';
  if (rank <= 30) return '🟡';
  return '⚪';
}
