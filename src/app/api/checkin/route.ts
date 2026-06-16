import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type CheckinInput = {
  date?: string; // YYYY-MM-DD
  energy?: number; // 1-5
  mood?: number; // 1-5
  sleepHours?: number | null;
  note?: string | null;
  focusValueId?: string | null;
};

function clamp1to5(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 3;
  return Math.min(5, Math.max(1, v));
}

// One check-in per day: upsert on the unique date so re-submitting edits it.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as CheckinInput;
  if (!body.date) return NextResponse.json({ error: "date required" }, { status: 400 });
  const date = new Date(body.date + "T00:00:00.000Z");
  const sleep =
    body.sleepHours == null || body.sleepHours === ("" as unknown)
      ? null
      : Math.max(0, Math.min(24, Number(body.sleepHours)));
  const data = {
    energy: clamp1to5(body.energy),
    mood: clamp1to5(body.mood),
    sleepHours: Number.isFinite(sleep as number) ? (sleep as number) : null,
    note: body.note?.trim() || null,
    focusValueId: body.focusValueId || null,
  };
  const row = await db.dailyCheckin.upsert({
    where: { date },
    create: { date, ...data },
    update: data,
  });
  return NextResponse.json({ ok: true, id: row.id });
}

export async function DELETE(req: NextRequest) {
  const { date } = (await req.json()) as { date?: string };
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });
  await db.dailyCheckin
    .delete({ where: { date: new Date(date + "T00:00:00.000Z") } })
    .catch(() => null);
  return NextResponse.json({ ok: true });
}
