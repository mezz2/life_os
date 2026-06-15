import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type StackInput = { id?: string; name?: string; cue?: string | null };

export async function POST(req: NextRequest) {
  const b = (await req.json()) as StackInput;
  const name = (b.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const max = await db.habitStack.aggregate({ _max: { sortOrder: true } });
  const stack = await db.habitStack.create({
    data: { name, cue: b.cue?.trim() || null, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  return NextResponse.json({ ok: true, id: stack.id });
}

export async function PUT(req: NextRequest) {
  const b = (await req.json()) as StackInput;
  if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const name = (b.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  await db.habitStack.update({ where: { id: b.id }, data: { name, cue: b.cue?.trim() || null } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.habitStack.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
