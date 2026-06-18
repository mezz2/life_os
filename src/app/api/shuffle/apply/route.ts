import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { keyToDate } from "@/lib/habits";
import { getConnection, pushCreate } from "@/lib/google-calendar";

// Apply an approved proposal: materialise placements as CalendarEvents tagged
// with a single shuffleBatch id so the whole set can be undone atomically.
// Advisory-by-design: nothing is written until the user approves a proposal.
//
// Applying writes to LifeOS's LOCAL cache only. Pushing those events up to the
// real Google Calendar is a separate, explicit confirm step (/api/shuffle/push)
// — so nothing reaches Google without the user asking for it. (The optional
// pushToGoogle flag lets a caller do both at once, but the UI keeps them split.)
type Placement = { blockId: string; title: string; dayKey: string; startMin: number; endMin: number };

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { placements?: Placement[]; pushToGoogle?: boolean };
  const placements = Array.isArray(body.placements) ? body.placements : [];
  if (placements.length === 0) return NextResponse.json({ error: "No placements to apply" }, { status: 400 });

  const push = body.pushToGoogle === true && !!(await getConnection());
  const batch = `shuffle_${Date.now()}`;
  let pushed = 0;
  for (const p of placements) {
    const dayBase = keyToDate(p.dayKey).getTime();
    const start = new Date(dayBase + p.startMin * 60000);
    const end = new Date(dayBase + p.endMin * 60000);

    let externalId: string | null = null;
    if (push) {
      try {
        externalId = await pushCreate({
          title: p.title,
          start: start.toISOString(),
          end: end.toISOString(),
          allDay: false,
        });
        pushed++;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Google create failed";
        console.error(`shuffle apply: Google push failed for "${p.title}": ${message}`);
      }
    }

    await db.calendarEvent.create({
      data: {
        externalId,
        title: p.title,
        start,
        end,
        allDay: false,
        rigidity: "flexible",
        shuffleBatch: batch,
      },
    });
  }
  return NextResponse.json({ ok: true, batch, count: placements.length, pushed });
}
