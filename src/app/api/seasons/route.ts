import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeGoalIds } from "@/lib/seasons";

type SeasonInput = {
  id?: string;
  name?: string;
  start?: string; // YYYY-MM-DD
  end?: string;
  theme?: string | null;
  valueId?: string | null;
  goalIds?: string[] | string | null;
};

function toDate(key: string | undefined): Date | null {
  if (!key) return null;
  const d = new Date(key + "T00:00:00.000Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalise(b: SeasonInput) {
  const start = toDate(b.start);
  const end = toDate(b.end);
  const goalArr = Array.isArray(b.goalIds)
    ? b.goalIds
    : typeof b.goalIds === "string"
      ? b.goalIds.split(",")
      : [];
  return {
    name: (b.name ?? "").trim(),
    start,
    end,
    theme: b.theme?.trim() || null,
    valueId: b.valueId || null,
    goalIds: serializeGoalIds(goalArr),
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as SeasonInput;
  const data = normalise(body);
  if (!data.name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (!data.start || !data.end) return NextResponse.json({ error: "Start and end dates required" }, { status: 400 });
  if (data.end < data.start) return NextResponse.json({ error: "End must be after start" }, { status: 400 });
  const max = await db.season.aggregate({ _max: { sortOrder: true } });
  const season = await db.season.create({
    data: { ...data, start: data.start, end: data.end, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  return NextResponse.json({ ok: true, id: season.id });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as SeasonInput;
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const data = normalise(body);
  if (!data.name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (!data.start || !data.end) return NextResponse.json({ error: "Start and end dates required" }, { status: 400 });
  if (data.end < data.start) return NextResponse.json({ error: "End must be after start" }, { status: 400 });
  await db.season.update({ where: { id: body.id }, data: { ...data, start: data.start, end: data.end } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.season.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
