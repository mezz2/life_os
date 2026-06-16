import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RIGIDITIES } from "@/lib/calendar";
import {
  getConnection,
  pushCreate,
  pushUpdate,
  pushDelete,
  type WriteEvent,
} from "@/lib/google-calendar";

// Manual event create + edit + delete, with write-back to Google when a
// calendar is connected. Local-only fields (rigidity / value / goal) never
// touch Google — they're LifeOS concepts. Schedule fields (title / start / end
// / allDay) are pushed to Google so edits show up everywhere.

type EventInput = {
  id?: string;
  title?: string;
  start?: string;
  end?: string;
  allDay?: boolean;
  rigidity?: string;
  valueId?: string | null;
  goalId?: string | null;
};

function rigidity(r: string | undefined): string {
  return RIGIDITIES.includes((r ?? "") as never) ? r! : "fixed";
}

async function connected(): Promise<boolean> {
  return !!(await getConnection());
}

export async function POST(req: NextRequest) {
  const b = (await req.json()) as EventInput;
  if (!b.title || !b.start || !b.end) {
    return NextResponse.json({ error: "title, start, end required" }, { status: 400 });
  }
  const write: WriteEvent = {
    title: b.title.trim(),
    start: b.start,
    end: b.end,
    allDay: !!b.allDay,
  };

  // Push to Google first so a failure doesn't leave an unsynced local event.
  let externalId: string | null = null;
  if (await connected()) {
    try {
      externalId = await pushCreate(write);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Google create failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  const ev = await db.calendarEvent.create({
    data: {
      externalId,
      title: write.title,
      start: new Date(write.start),
      end: new Date(write.end),
      allDay: write.allDay,
      rigidity: rigidity(b.rigidity),
      valueId: b.valueId || null,
      goalId: b.goalId || null,
    },
  });
  return NextResponse.json({ ok: true, id: ev.id, externalId });
}

export async function PUT(req: NextRequest) {
  const b = (await req.json()) as EventInput;
  if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const existing = await db.calendarEvent.findUnique({ where: { id: b.id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Schedule edit present? (any of title/start/end/allDay supplied)
  const editsSchedule =
    b.title !== undefined || b.start !== undefined || b.end !== undefined || b.allDay !== undefined;

  if (editsSchedule && existing.externalId && (await connected())) {
    const write: WriteEvent = {
      title: (b.title ?? existing.title).trim(),
      start: b.start ?? existing.start.toISOString(),
      end: b.end ?? existing.end.toISOString(),
      allDay: b.allDay ?? existing.allDay,
    };
    try {
      await pushUpdate(existing.externalId, write);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Google update failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  await db.calendarEvent.update({
    where: { id: b.id },
    data: {
      // Schedule fields update only when supplied.
      ...(b.title !== undefined ? { title: b.title.trim() } : {}),
      ...(b.start !== undefined ? { start: new Date(b.start) } : {}),
      ...(b.end !== undefined ? { end: new Date(b.end) } : {}),
      ...(b.allDay !== undefined ? { allDay: b.allDay } : {}),
      // Local-only tags always reflect the request.
      rigidity: rigidity(b.rigidity),
      valueId: b.valueId || null,
      goalId: b.goalId || null,
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const existing = await db.calendarEvent.findUnique({ where: { id } });
  if (existing?.externalId && (await connected())) {
    try {
      await pushDelete(existing.externalId);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Google delete failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }
  await db.calendarEvent.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
