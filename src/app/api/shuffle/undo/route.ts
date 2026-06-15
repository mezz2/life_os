import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Undo a shuffle: delete every event created by that batch. With no batch given,
// undo the most recent one. Makes the whole flow reversible (never silent).
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { batch?: string };
  let batch = body.batch;
  if (!batch) {
    const latest = await db.calendarEvent.findFirst({
      where: { shuffleBatch: { not: null } },
      orderBy: { syncedAt: "desc" },
      select: { shuffleBatch: true },
    });
    batch = latest?.shuffleBatch ?? undefined;
  }
  if (!batch) return NextResponse.json({ ok: true, removed: 0 });
  const res = await db.calendarEvent.deleteMany({ where: { shuffleBatch: batch } });
  return NextResponse.json({ ok: true, batch, removed: res.count });
}
