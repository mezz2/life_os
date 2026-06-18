import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type GoalInput = {
  name?: string;
  term?: string;
  kind?: string; // financial | habit | outcome
  targetAmount?: number | null;
  currentAmount?: number;
  targetDate?: string | null;
  linkedBucket?: string | null; // legacy single
  linkedBuckets?: string[]; // multiple net-worth buckets
  notes?: string | null;
  valueId?: string | null; // the value this goal serves
};

const GOAL_KINDS = new Set(["financial", "habit", "outcome"]);

// Multiple linked buckets are stored comma-separated in the existing
// `linkedBucket` column (bucket names never contain commas).
function parseBuckets(body: GoalInput): string[] {
  if (Array.isArray(body.linkedBuckets)) return body.linkedBuckets.filter(Boolean);
  if (body.linkedBucket) return body.linkedBucket.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

// Sum of the linked buckets from the latest snapshot, so linking reflects immediately.
async function currentFromBuckets(buckets: string[]): Promise<number | null> {
  if (buckets.length === 0) return null;
  const snap = await db.netWorthSnapshot.findFirst({ orderBy: { date: "desc" }, include: { entries: true } });
  if (!snap) return null;
  const byBucket = new Map(snap.entries.map((e) => [e.bucket, e.amount]));
  return buckets.reduce((t, b) => t + (byBucket.get(b) ?? 0), 0);
}

async function normalise(body: GoalInput) {
  const buckets = parseBuckets(body);
  const manual = typeof body.currentAmount === "number" && !Number.isNaN(body.currentAmount) ? body.currentAmount : 0;
  const synced = await currentFromBuckets(buckets);
  return {
    name: (body.name ?? "").trim(),
    term: body.term === "long" ? "long" : "short",
    kind: GOAL_KINDS.has(body.kind ?? "") ? body.kind! : "financial",
    targetAmount: body.targetAmount != null && !Number.isNaN(body.targetAmount) ? body.targetAmount : null,
    currentAmount: synced ?? manual,
    targetDate: body.targetDate ? new Date(body.targetDate + "T00:00:00.000Z") : null,
    linkedBucket: buckets.length ? buckets.join(",") : null,
    notes: body.notes?.trim() || null,
    valueId: body.valueId?.trim() || null,
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as GoalInput;
  const data = await normalise(body);
  if (!data.name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const max = await db.goal.aggregate({ _max: { sortOrder: true } });
  const goal = await db.goal.create({ data: { ...data, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  return NextResponse.json({ ok: true, id: goal.id });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as GoalInput & { id?: string };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const data = await normalise(body);
  if (!data.name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  await db.goal.update({ where: { id: body.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.goal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
