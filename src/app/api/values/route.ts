import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type ValueInput = {
  id?: string;
  name?: string;
  description?: string | null;
};

function normalise(body: ValueInput) {
  return {
    name: (body.name ?? "").trim(),
    description: body.description?.trim() || null,
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ValueInput;
  const data = normalise(body);
  if (!data.name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const max = await db.value.aggregate({ _max: { sortOrder: true } });
  try {
    const value = await db.value.create({ data: { ...data, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
    return NextResponse.json({ ok: true, id: value.id });
  } catch {
    return NextResponse.json({ error: "A value with that name already exists" }, { status: 409 });
  }
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as ValueInput;
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const data = normalise(body);
  if (!data.name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  await db.value.update({ where: { id: body.id }, data });
  return NextResponse.json({ ok: true });
}

// Deleting a value detaches its goals/habits (FK is SetNull), it doesn't remove them.
export async function DELETE(req: NextRequest) {
  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.value.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
