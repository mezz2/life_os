import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { keyToDate, todayKey } from "@/lib/habits";

type LogInput = {
  habitId?: string;
  date?: string; // YYYY-MM-DD (defaults to today)
  status?: string; // done | partial | skipped
  value?: number | null;
  notes?: string | null;
};

const STATUSES = new Set(["done", "partial", "skipped"]);

// Upsert a single day's log for a habit (one row per habit+date). Used for the
// one-tap check-off and for setting partial/skipped or a quantified value.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as LogInput;
  if (!body.habitId) return NextResponse.json({ error: "habitId required" }, { status: 400 });
  const key = body.date ?? todayKey();
  const date = keyToDate(key);
  const status = STATUSES.has(body.status ?? "") ? body.status! : "done";
  const value = typeof body.value === "number" && !Number.isNaN(body.value) ? body.value : null;
  const notes = body.notes?.trim() || null;

  await db.habitLog.upsert({
    where: { habitId_date: { habitId: body.habitId, date } },
    create: { habitId: body.habitId, date, status, value, notes },
    update: { status, value, notes },
  });
  return NextResponse.json({ ok: true });
}

// Clear a day's log (un-check).
export async function DELETE(req: NextRequest) {
  const body = (await req.json()) as { habitId?: string; date?: string };
  if (!body.habitId) return NextResponse.json({ error: "habitId required" }, { status: 400 });
  const date = keyToDate(body.date ?? todayKey());
  await db.habitLog.deleteMany({ where: { habitId: body.habitId, date } });
  return NextResponse.json({ ok: true });
}
