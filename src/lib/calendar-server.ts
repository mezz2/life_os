// Calendar cache writes — shared by the push endpoint (/api/calendar/sync) and
// the Google pull (/api/calendar/refresh). Upsert by externalId so a re-sync
// refreshes calendar-sourced fields WITHOUT clobbering local tagging
// (valueId / goalId / rigidity are LifeOS-only and preserved across syncs).

import { db } from "./db";

export type UpsertEvent = {
  externalId: string;
  calendarId?: string | null;
  title?: string;
  start?: string; // ISO
  end?: string; // ISO
  allDay?: boolean;
  raw?: unknown;
};

export async function upsertEvents(
  events: UpsertEvent[],
): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;
  for (const e of events) {
    if (!e.externalId || !e.start || !e.end) continue;
    const data = {
      calendarId: e.calendarId ?? null,
      title: (e.title ?? "(untitled)").trim() || "(untitled)",
      start: new Date(e.start),
      end: new Date(e.end),
      allDay: !!e.allDay,
      raw: e.raw != null ? JSON.stringify(e.raw) : null,
      syncedAt: new Date(),
    };
    const existing = await db.calendarEvent.findUnique({ where: { externalId: e.externalId } });
    if (existing) {
      await db.calendarEvent.update({ where: { externalId: e.externalId }, data });
      updated++;
    } else {
      await db.calendarEvent.create({ data: { externalId: e.externalId, ...data } });
      added++;
    }
  }
  return { added, updated };
}
