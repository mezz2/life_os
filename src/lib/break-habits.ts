// Break-habit mechanics — pure helpers for the inverse of build habits. Instead
// of streaks of completions, break habits track "time since last slip" and how
// often urges were resisted. No DB; timestamps are ISO strings, `now` injected
// for testability.

export type UrgeLite = { timestamp: string; gaveIn: boolean; intensity?: number | null };

// The most recent slip (gaveIn) timestamp, or null if never slipped.
export function lastSlip(logs: UrgeLite[]): string | null {
  let latest: string | null = null;
  for (const l of logs) {
    if (l.gaveIn && (latest === null || l.timestamp > latest)) latest = l.timestamp;
  }
  return latest;
}

// Elapsed time since `sinceISO`, broken into days + leftover hours.
export function timeSince(sinceISO: string, nowISO: string): { totalMinutes: number; days: number; hours: number } {
  const ms = Math.max(0, new Date(nowISO).getTime() - new Date(sinceISO).getTime());
  const totalMinutes = Math.floor(ms / 60000);
  return { totalMinutes, days: Math.floor(totalMinutes / 1440), hours: Math.floor((totalMinutes % 1440) / 60) };
}

// "Clean" time for a break habit: since the last slip, or since the habit was
// created if it's never been slipped.
export function cleanStreak(
  logs: UrgeLite[],
  createdISO: string,
  nowISO: string,
): { since: string; totalMinutes: number; days: number; hours: number; everSlipped: boolean } {
  const slip = lastSlip(logs);
  const since = slip ?? createdISO;
  return { since, everSlipped: slip != null, ...timeSince(since, nowISO) };
}

export function urgeStats(logs: UrgeLite[]): { total: number; resisted: number; gaveIn: number; resistRate: number } {
  const total = logs.length;
  const gaveIn = logs.filter((l) => l.gaveIn).length;
  const resisted = total - gaveIn;
  return { total, resisted, gaveIn, resistRate: total === 0 ? 0 : resisted / total };
}

export function formatSince(t: { days: number; hours: number }): string {
  if (t.days === 0 && t.hours === 0) return "just now";
  if (t.days === 0) return `${t.hours}h`;
  if (t.hours === 0) return `${t.days}d`;
  return `${t.days}d ${t.hours}h`;
}
