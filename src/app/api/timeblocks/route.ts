import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type TBInput = {
  id?: string;
  title?: string;
  rigidity?: string;
  durationMin?: number;
  minChunkMin?: number;
  energy?: string;
  days?: number[] | string | null;
  startMin?: number;
  endMin?: number;
  theme?: string | null;
  priority?: number;
  habitId?: string | null;
};

const RIGIDITY = new Set(["flexible", "elastic", "fluid"]);
const ENERGY = new Set(["high", "low", "any"]);

function parseDays(d: TBInput["days"]): string | null {
  const arr = Array.isArray(d) ? d : typeof d === "string" ? d.split(",") : [];
  const days = arr.map((x) => Number(String(x).trim())).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return days.length ? [...new Set(days)].sort((a, b) => a - b).join(",") : null;
}

function normalise(b: TBInput) {
  const clampMin = (n: unknown, def: number) => {
    const v = Math.round(Number(n));
    return Number.isFinite(v) ? Math.max(0, Math.min(1440, v)) : def;
  };
  return {
    title: (b.title ?? "").trim(),
    rigidity: RIGIDITY.has(b.rigidity ?? "") ? b.rigidity! : "flexible",
    durationMin: Math.max(5, Math.round(Number(b.durationMin) || 30)),
    minChunkMin: Math.max(5, Math.round(Number(b.minChunkMin) || 30)),
    energy: ENERGY.has(b.energy ?? "") ? b.energy! : "any",
    days: parseDays(b.days),
    startMin: clampMin(b.startMin, 360),
    endMin: clampMin(b.endMin, 1320),
    theme: b.theme?.trim() || null,
    priority: Number.isFinite(Number(b.priority)) ? Math.round(Number(b.priority)) : 100,
    habitId: b.habitId || null,
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as TBInput;
  const data = normalise(body);
  if (!data.title) return NextResponse.json({ error: "Title required" }, { status: 400 });
  const tb = await db.timeBlock.create({ data });
  return NextResponse.json({ ok: true, id: tb.id });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as TBInput;
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const data = normalise(body);
  if (!data.title) return NextResponse.json({ error: "Title required" }, { status: 400 });
  await db.timeBlock.update({ where: { id: body.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.timeBlock.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
