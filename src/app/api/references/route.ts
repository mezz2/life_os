import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normaliseUrl, inferSource } from "@/lib/references";

type RefInput = {
  id?: string;
  title?: string;
  url?: string | null;
  note?: string | null;
  valueId?: string | null;
  goalId?: string | null;
};

function normalise(b: RefInput) {
  const url = normaliseUrl(b.url);
  return {
    title: (b.title ?? "").trim(),
    url,
    source: url ? inferSource(url) : null,
    note: b.note?.trim() || null,
    valueId: b.valueId || null,
    goalId: b.goalId || null,
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as RefInput;
  const data = normalise(body);
  if (!data.title) return NextResponse.json({ error: "Title required" }, { status: 400 });
  const max = await db.reference.aggregate({ _max: { sortOrder: true } });
  const ref = await db.reference.create({ data: { ...data, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  return NextResponse.json({ ok: true, id: ref.id });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as RefInput;
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const data = normalise(body);
  if (!data.title) return NextResponse.json({ error: "Title required" }, { status: 400 });
  await db.reference.update({ where: { id: body.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.reference.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
