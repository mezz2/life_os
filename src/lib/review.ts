// Weekly review — pure aggregation + digest composition. Joins the week's habit
// completion, identity votes, time-by-value, and goal pace into a short digest.
// No DB; deterministic so it's unit-testable. The /review page feeds it numbers.

import { startOfWeekKey, addDaysKey } from "./habits";

// Required weekly contribution to hit a goal by its date, and whether the
// current pace is on track. Returns null when there's no target/date to pace to.
export function goalPace(
  current: number,
  target: number | null,
  targetDateKey: string | null,
  todayKey: string,
): { requiredPerWeek: number; remaining: number; weeksLeft: number } | null {
  if (!target || target <= 0 || !targetDateKey) return null;
  const remaining = Math.max(0, target - current);
  const ms = new Date(targetDateKey + "T00:00:00Z").getTime() - new Date(todayKey + "T00:00:00Z").getTime();
  const weeksLeft = Math.max(0, ms / (7 * 86400000));
  const requiredPerWeek = weeksLeft > 0 ? remaining / weeksLeft : remaining;
  return { requiredPerWeek, remaining, weeksLeft };
}

export type DigestInput = {
  weekStartKey: string;
  habitsDone: number; // completions this week
  habitsDue: number; // due opportunities this week
  votes: number;
  topValue: { name: string; votes: number } | null;
  trackedMinutes: number;
  topTimeValue: { name: string; minutes: number } | null;
  avgEnergy: number | null; // 1..5 or null
  topGoal: { name: string; pct: number } | null;
};

export type Digest = { title: string; lines: string[] };

function fmtHrs(min: number): string {
  const h = min / 60;
  return h >= 10 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`;
}

// Compose the human-readable digest. Pure: same input -> same output.
export function composeDigest(d: DigestInput): Digest {
  const weekEnd = addDaysKey(d.weekStartKey, 6);
  const rate = d.habitsDue > 0 ? d.habitsDone / d.habitsDue : 0;
  const lines: string[] = [];

  lines.push(
    d.habitsDue > 0
      ? `Habits: ${d.habitsDone}/${d.habitsDue} completed (${Math.round(rate * 100)}%).`
      : `Habits: nothing was due this week.`,
  );
  if (d.votes > 0) {
    lines.push(
      d.topValue
        ? `Cast ${d.votes} votes for who you're becoming — most for ${d.topValue.name} (${d.topValue.votes}).`
        : `Cast ${d.votes} votes for who you're becoming.`,
    );
  }
  if (d.trackedMinutes > 0 && d.topTimeValue) {
    lines.push(`Time: ${fmtHrs(d.trackedMinutes)} tracked, most on ${d.topTimeValue.name} (${fmtHrs(d.topTimeValue.minutes)}).`);
  }
  if (d.avgEnergy != null) {
    lines.push(`Average energy ${d.avgEnergy.toFixed(1)}/5.`);
  }
  if (d.topGoal) {
    lines.push(`Top goal "${d.topGoal.name}" is ${Math.round(d.topGoal.pct * 100)}% there.`);
  }

  return { title: `Week of ${d.weekStartKey} – ${weekEnd}`, lines };
}

export { startOfWeekKey };
