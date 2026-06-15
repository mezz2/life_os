import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { renumber } from "@/lib/stacks";

// Add a habit to the end of a stack.
export async function POST(req: NextRequest) {
  const { stackId, habitId } = (await req.json()) as { stackId?: string; habitId?: string };
  if (!stackId || !habitId) return NextResponse.json({ error: "stackId and habitId required" }, { status: 400 });
  const max = await db.habitStackItem.aggregate({ where: { stackId }, _max: { order: true } });
  try {
    await db.habitStackItem.create({ data: { stackId, habitId, order: (max._max.order ?? -1) + 1 } });
  } catch {
    return NextResponse.json({ error: "Habit already in this stack" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

// Reorder a stack from a full ordered list of habit ids.
export async function PUT(req: NextRequest) {
  const { stackId, orderedHabitIds } = (await req.json()) as { stackId?: string; orderedHabitIds?: string[] };
  if (!stackId || !Array.isArray(orderedHabitIds)) {
    return NextResponse.json({ error: "stackId and orderedHabitIds required" }, { status: 400 });
  }
  const items = renumber(orderedHabitIds);
  await db.$transaction(
    items.map((it) =>
      db.habitStackItem.updateMany({ where: { stackId, habitId: it.habitId }, data: { order: it.order } }),
    ),
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { stackId, habitId } = (await req.json()) as { stackId?: string; habitId?: string };
  if (!stackId || !habitId) return NextResponse.json({ error: "stackId and habitId required" }, { status: 400 });
  await db.habitStackItem.deleteMany({ where: { stackId, habitId } });
  return NextResponse.json({ ok: true });
}
