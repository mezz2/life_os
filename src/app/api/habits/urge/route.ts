import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Log an urge for a break habit — either resisted (gaveIn=false) or a slip
// (gaveIn=true, which resets the "time since" counter).
type UrgeInput = {
  habitId?: string;
  gaveIn?: boolean;
  intensity?: number | null;
  trigger?: string | null;
  note?: string | null;
};

export async function POST(req: NextRequest) {
  const b = (await req.json()) as UrgeInput;
  if (!b.habitId) return NextResponse.json({ error: "habitId required" }, { status: 400 });
  const intensity =
    b.intensity == null ? null : Math.min(5, Math.max(1, Math.round(Number(b.intensity))));
  const urge = await db.urgeLog.create({
    data: {
      habitId: b.habitId,
      gaveIn: !!b.gaveIn,
      intensity: Number.isFinite(intensity as number) ? intensity : null,
      trigger: b.trigger?.trim() || null,
      note: b.note?.trim() || null,
    },
  });
  return NextResponse.json({ ok: true, id: urge.id });
}

// Undo the most recent urge for a habit (mis-tap recovery).
export async function DELETE(req: NextRequest) {
  const { habitId } = (await req.json()) as { habitId?: string };
  if (!habitId) return NextResponse.json({ error: "habitId required" }, { status: 400 });
  const latest = await db.urgeLog.findFirst({ where: { habitId }, orderBy: { timestamp: "desc" } });
  if (latest) await db.urgeLog.delete({ where: { id: latest.id } });
  return NextResponse.json({ ok: true });
}
