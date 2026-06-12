export const TEAM_FLAG_CODES: Record<string, string> = {
  'Argentina': 'ar', 'Spain': 'es', 'France': 'fr', 'England': 'gb-eng',
  'Portugal': 'pt', 'Brazil': 'br', 'Belgium': 'be', 'Netherlands': 'nl',
  'Germany': 'de', 'Uruguay': 'uy', 'Croatia': 'hr', 'Switzerland': 'ch',
  'Japan': 'jp', 'Türkiye': 'tr', 'Colombia': 'co', 'Mexico': 'mx',
  'USA': 'us', 'Sweden': 'se', 'South Korea': 'kr', 'Norway': 'no',
  'Czechia': 'cz', 'Paraguay': 'py', 'Saudi Arabia': 'sa',
  'Bosnia and Herzegovina': 'ba', 'Morocco': 'ma', 'Iran': 'ir',
  'Ecuador': 'ec', 'Senegal': 'sn', 'Egypt': 'eg', 'Canada': 'ca',
  'Algeria': 'dz', 'Ivory Coast': 'ci', 'Scotland': 'gb-sct',
  'Austria': 'at', 'Australia': 'au', 'Ghana': 'gh', 'South Africa': 'za',
  'Uzbekistan': 'uz', 'Tunisia': 'tn', 'Cabo Verde': 'cv', 'DR Congo': 'cd',
  'Panama': 'pa', 'Qatar': 'qa', 'Haiti': 'ht', 'Iraq': 'iq',
  'Curaçao': 'cw', 'New Zealand': 'nz', 'Jordan': 'jo',
};

const FLAGCDN_WIDTHS = [20, 40, 80, 160, 320, 640, 1280, 2560];

export function getFlagCdnWidth(size: number): number {
  return FLAGCDN_WIDTHS.find((w) => w >= size) ?? FLAGCDN_WIDTHS[FLAGCDN_WIDTHS.length - 1];
}

export function getFlagUrl(team: string, size: number = 20): string {
  const code = TEAM_FLAG_CODES[team];
  if (!code) return '';
  return `https://flagcdn.com/w${getFlagCdnWidth(size)}/${code}.png`;
}
