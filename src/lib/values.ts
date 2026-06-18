// Values layer — pure helpers for the "identity votes" idea (Atomic Habits):
// every habit completion this week is a vote for the value/identity it serves.
// No DB access; operates on plain shapes so it's trivially unit-testable.

import { startOfWeekKey, type HabitLogLite } from "./habits";

export type HabitWithLinks = {
  id: string;
  name: string;
  identityStatement: string | null;
  valueId: string | null;
  logs: HabitLogLite[];
};

export type ValueLite = { id: string; name: string };

// Completions (done|partial) recorded in the current Monday-anchored week.
export function completionsThisWeek(logs: HabitLogLite[], todayK: string): number {
  const week = startOfWeekKey(todayK);
  return logs.filter(
    (l) => (l.status === "done" || l.status === "partial") && startOfWeekKey(l.date) === week,
  ).length;
}

export type ValueVotes = {
  valueId: string;
  name: string;
  votes: number;
  habitCount: number;
};

// Votes this week grouped by value, plus a grand total. Habits with no value
// still count toward the total but are bucketed under a null-id "Unassigned"
// only if includeUnassigned is set (the /habits counter does not).
export function votesByValue(
  habits: HabitWithLinks[],
  values: ValueLite[],
  todayK: string,
): { total: number; byValue: ValueVotes[] } {
  const nameOf = new Map(values.map((v) => [v.id, v.name]));
  const acc = new Map<string, { votes: number; habitCount: number }>();
  let total = 0;
  for (const h of habits) {
    const v = completionsThisWeek(h.logs, todayK);
    total += v;
    if (!h.valueId) continue;
    const cur = acc.get(h.valueId) ?? { votes: 0, habitCount: 0 };
    cur.votes += v;
    cur.habitCount += 1;
    acc.set(h.valueId, cur);
  }
  const byValue = [...acc.entries()]
    .map(([valueId, x]) => ({ valueId, name: nameOf.get(valueId) ?? "—", ...x }))
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));
  return { total, byValue };
}

// Alignment score for a value: the mean of its habits' completion rates (0..1).
// A value with no habits is "unmeasured" -> null (so the UI can say "link a habit").
export function alignmentScore(rates: number[]): number | null {
  if (rates.length === 0) return null;
  return rates.reduce((t, r) => t + r, 0) / rates.length;
}
