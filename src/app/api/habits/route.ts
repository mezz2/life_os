import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type HabitInput = {
  name?: string;
  identityStatement?: string | null;
  type?: string; // build | break
  cadence?: string; // daily | weekly_count | weekdays
  targetCount?: number | null;
  weekdays?: string | string[] | null; // CSV or array of 0-6
  cue?: string | null;
  craving?: string | null;
  response?: string | null;
  reward?: string | null;
  twoMinVersion?: string | null;
  archived?: boolean;
};

const CADENCES = new Set(["daily", "weekly_count", "weekdays"]);

function clean(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  return t === "" ? null : t;
}

// Normalise weekdays to a sorted CSV of valid 0-6 values (or null).
function parseWeekdays(w: HabitInput["weekdays"]): string | null {
  const arr = Array.isArray(w) ? w : typeof w === "string" ? w.split(",") : [];
  const days = arr
    .map((x) => Number(String(x).trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  const uniq = [...new Set(days)].sort((a, b) => a - b);
  return uniq.length ? uniq.join(",") : null;
}

function normalise(body: HabitInput) {
  const cadence = CADENCES.has(body.cadence ?? "") ? body.cadence! : "daily";
  const targetCount =
    cadence === "weekly_count"
      ? Math.max(1, Math.round(Number(body.targetCount) || 1))
      : null;
  return {
    name: (body.name ?? "").trim(),
    identityStatement: clean(body.identityStatement),
    type: body.type === "break" ? "break" : "build",
    cadence,
    targetCount,
    weekdays: cadence === "weekdays" ? parseWeekdays(body.weekdays) : null,
    cue: clean(body.cue),
    craving: clean(body.craving),
    response: clean(body.response),
    reward: clean(body.reward),
    twoMinVersion: clean(body.twoMinVersion),
    archived: !!body.archived,
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as HabitInput;
  const data = normalise(body);
  if (!data.name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const max = await db.habit.aggregate({ _max: { sortOrder: true } });
  const habit = await db.habit.create({ data: { ...data, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  return NextResponse.json({ ok: true, id: habit.id });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as HabitInput & { id?: string };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const data = normalise(body);
  if (!data.name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  await db.habit.update({ where: { id: body.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.habit.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
