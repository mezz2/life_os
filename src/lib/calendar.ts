// Calendar time-allocation — pure helpers. The time analogue of the spending
// breakdown: where did the week actually go, grouped by the value each event
// serves. No DB access; operates on plain ISO-string shapes.

import { startOfWeekKey, dateKey, addDaysKey } from "./habits";

export type EventLite = {
  id: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  rigidity: string;
  valueId: string | null;
};

export const RIGIDITIES = ["fixed", "flexible", "elastic", "fluid"] as const;
export type Rigidity = (typeof RIGIDITIES)[number];

export function durationMin(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return ms > 0 ? Math.round(ms / 60000) : 0;
}

// Events whose start falls in the Monday-anchored week containing `dayKey`.
export function eventsInWeek<T extends { start: string }>(events: T[], dayKey: string): T[] {
  const ws = startOfWeekKey(dayKey);
  return events.filter((e) => startOfWeekKey(dateKey(new Date(e.start))) === ws);
}

export type ValueTime = { valueId: string | null; name: string; minutes: number };

// Total minutes per value across the given events (all-day events excluded —
// they have no meaningful duration). Untagged time is bucketed under null.
export function timeByValue(
  events: EventLite[],
  valueNames: Map<string, string>,
): ValueTime[] {
  const acc = new Map<string | null, number>();
  for (const e of events) {
    if (e.allDay) continue;
    const mins = durationMin(e.start, e.end);
    if (mins <= 0) continue;
    acc.set(e.valueId, (acc.get(e.valueId) ?? 0) + mins);
  }
  return [...acc.entries()]
    .map(([valueId, minutes]) => ({
      valueId,
      name: valueId == null ? "Untagged" : valueNames.get(valueId) ?? "—",
      minutes,
    }))
    .sort((a, b) => b.minutes - a.minutes);
}

export function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Seven day-column keys (Mon..Sun) for the week containing `dayKey`.
export function weekDayKeys(dayKey: string): string[] {
  const ws = startOfWeekKey(dayKey);
  return Array.from({ length: 7 }, (_, i) => addDaysKey(ws, i));
}
