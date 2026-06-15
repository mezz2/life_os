import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { keyToDate } from "@/lib/habits";

// Apply an approved proposal: materialise placements as CalendarEvents tagged
// with a single shuffleBatch id so the whole set can be undone atomically.
// Advisory-by-design: nothing is written until the user approves a proposal.
type Placement = { blockId: string; title: string; dayKey: string; startMin: number; endMin: number };

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { placements?: Placement[] };
  const placements = Array.isArray(body.placements) ? body.placements : [];
  if (placements.length === 0) return NextResponse.json({ error: "No placements to apply" }, { status: 400 });

  const batch = `shuffle_${Date.now()}`;
  for (const p of placements) {
    const dayBase = keyToDate(p.dayKey).getTime();
    await db.calendarEvent.create({
      data: {
        title: p.title,
        start: new Date(dayBase + p.startMin * 60000),
        end: new Date(dayBase + p.endMin * 60000),
        allDay: false,
        rigidity: "flexible",
        shuffleBatch: batch,
      },
    });
  }
  return NextResponse.json({ ok: true, batch, count: placements.length });
}
