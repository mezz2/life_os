import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RIGIDITIES } from "@/lib/calendar";

// Manual event create + local tagging (rigidity / value / goal). Calendar-sourced
// events are created via /api/calendar/sync; this is for user edits.

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

export async function POST(req: NextRequest) {
  const b = (await req.json()) as EventInput;
  if (!b.title || !b.start || !b.end) {
    return NextResponse.json({ error: "title, start, end required" }, { status: 400 });
  }
  const ev = await db.calendarEvent.create({
    data: {
      title: b.title.trim(),
      start: new Date(b.start),
      end: new Date(b.end),
      allDay: !!b.allDay,
      rigidity: rigidity(b.rigidity),
      valueId: b.valueId || null,
      goalId: b.goalId || null,
    },
  });
  return NextResponse.json({ ok: true, id: ev.id });
}

// Tagging an event: only the local fields are editable here.
export async function PUT(req: NextRequest) {
  const b = (await req.json()) as EventInput;
  if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.calendarEvent.update({
    where: { id: b.id },
    data: {
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
  await db.calendarEvent.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
