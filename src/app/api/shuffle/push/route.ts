import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getConnection, pushCreate } from "@/lib/google-calendar";

// Explicit confirm step: push an already-applied shuffle batch up to the real
// Google Calendar. Only events in this batch that aren't on Google yet
// (externalId null) are pushed; the returned externalId is stored so undo can
// remove them from Google too. Idempotent — re-running won't create duplicates.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { batch?: string };
  if (!body.batch) return NextResponse.json({ error: "batch required" }, { status: 400 });

  if (!(await getConnection())) {
    return NextResponse.json({ error: "Google Calendar isn't connected." }, { status: 409 });
  }

  const rows = await db.calendarEvent.findMany({
    where: { shuffleBatch: body.batch, externalId: null },
    select: { id: true, title: true, start: true, end: true, allDay: true },
  });

  let pushed = 0;
  const failed: string[] = [];
  for (const r of rows) {
    try {
      const externalId = await pushCreate({
        title: r.title,
        start: r.start.toISOString(),
        end: r.end.toISOString(),
        allDay: r.allDay,
      });
      await db.calendarEvent.update({ where: { id: r.id }, data: { externalId } });
      pushed++;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Google create failed";
      console.error(`shuffle push: failed for "${r.title}": ${message}`);
      failed.push(r.title);
    }
  }

  if (failed.length > 0) {
    return NextResponse.json(
      { ok: false, pushed, failedCount: failed.length, error: `Couldn't push ${failed.length} event(s) to Google.` },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, pushed });
}
