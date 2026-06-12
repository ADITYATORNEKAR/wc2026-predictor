export function formatMatchDate(isoString: string): string {
  return (
    new Date(isoString).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }) + ' ET'
  );
}
// Example output: "Thu, Jun 11, 3:00 PM ET"

export function formatMatchDateShort(isoString: string): string {
  return (
    new Date(isoString).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }) + ' ET'
  );
}
// Example output: "Jun 11, 3:00 PM ET"

export function hasMatchStarted(isoString: string): boolean {
  return new Date() > new Date(isoString);
}

export function isWithin48Hours(isoString: string): boolean {
  const matchTime = new Date(isoString).getTime();
  const now = Date.now();
  return matchTime - now <= 48 * 60 * 60 * 1000 && matchTime > now;
}

export function timeUntilMatch(isoString: string): string {
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff <= 0) return 'Started';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 48) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours >= 1) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
