import { NextRequest, NextResponse } from "next/server";
import { upsertEvents, type UpsertEvent } from "@/lib/calendar-server";

// Push endpoint — events fed in from a script or the Google Calendar MCP. The
// app is local-first and always reads its own cache. For the in-app "Refresh"
// button that pulls directly from Google, see /api/calendar/refresh.

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { events?: UpsertEvent[] };
  const events = Array.isArray(body.events) ? body.events : [];
  const { added, updated } = await upsertEvents(events);
  return NextResponse.json({ ok: true, added, updated });
}
