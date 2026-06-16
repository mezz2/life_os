import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getConnection, pushDelete } from "@/lib/google-calendar";

// Undo a shuffle: delete every event created by that batch. With no batch given,
// undo the most recent one. Makes the whole flow reversible (never silent).
// Events that were pushed to Google (externalId set) are deleted there first so
// undo stays in sync everywhere; pushDelete treats already-gone events as ok.
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

  const rows = await db.calendarEvent.findMany({
    where: { shuffleBatch: batch },
    select: { id: true, externalId: true },
  });

  if (await getConnection()) {
    for (const r of rows) {
      if (!r.externalId) continue;
      try {
        await pushDelete(r.externalId);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Google delete failed";
        console.error(`shuffle undo: Google delete failed for ${r.externalId}: ${message}`);
      }
    }
  }

  const res = await db.calendarEvent.deleteMany({ where: { shuffleBatch: batch } });
  return NextResponse.json({ ok: true, batch, removed: res.count });
}
