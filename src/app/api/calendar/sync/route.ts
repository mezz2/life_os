import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Events are pushed in from the Google Calendar MCP (or a script) — the app is
// local-first and always reads its own cache. Upsert by externalId so a re-sync
// refreshes calendar-sourced fields WITHOUT clobbering the user's local tagging
// (valueId / goalId / rigidity are preserved across syncs).

type SyncEvent = {
  externalId: string;
  calendarId?: string | null;
  title?: string;
  start?: string; // ISO
  end?: string; // ISO
  allDay?: boolean;
  raw?: unknown;
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { events?: SyncEvent[] };
  const events = Array.isArray(body.events) ? body.events : [];
  let added = 0;
  let updated = 0;
  for (const e of events) {
    if (!e.externalId || !e.start || !e.end) continue;
    const cal = {
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
      await db.calendarEvent.update({ where: { externalId: e.externalId }, data: cal });
      updated++;
    } else {
      await db.calendarEvent.create({ data: { externalId: e.externalId, ...cal } });
      added++;
    }
  }
  return NextResponse.json({ ok: true, added, updated });
}
