import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, entries } = body as {
    date: string;
    entries: { bucket: string; amount: number }[];
  };
  if (!date || !Array.isArray(entries)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const snapDate = new Date(date + "T00:00:00.000Z");

  const existing = await db.netWorthSnapshot.findUnique({ where: { date: snapDate } });
  let snapId: string;
  let updated = false;
  if (existing) {
    await db.netWorthEntry.deleteMany({ where: { snapshotId: existing.id } });
    await db.netWorthEntry.createMany({
      data: entries.map((e) => ({ snapshotId: existing.id, bucket: e.bucket, amount: e.amount })),
    });
    snapId = existing.id;
    updated = true;
  } else {
    const snap = await db.netWorthSnapshot.create({ data: { date: snapDate } });
    await db.netWorthEntry.createMany({
      data: entries.map((e) => ({ snapshotId: snap.id, bucket: e.bucket, amount: e.amount })),
    });
    snapId = snap.id;
  }

  await syncLinkedGoals(entries);

  return NextResponse.json({ ok: true, id: snapId, updated });
}

// Delete a whole snapshot (a date's entry) by date. Re-syncs linked goals to
// whatever the latest remaining snapshot is.
export async function DELETE(req: NextRequest) {
  const { date } = (await req.json()) as { date?: string };
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const snapDate = new Date(date + "T00:00:00.000Z");
  const existing = await db.netWorthSnapshot.findUnique({ where: { date: snapDate } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.netWorthEntry.deleteMany({ where: { snapshotId: existing.id } });
  await db.netWorthSnapshot.delete({ where: { id: existing.id } });

  const latest = await db.netWorthSnapshot.findFirst({
    orderBy: { date: "desc" },
    include: { entries: true },
  });
  if (latest) await syncLinkedGoals(latest.entries.map((e) => ({ bucket: e.bucket, amount: e.amount })));

  return NextResponse.json({ ok: true });
}

// Keep each goal's currentAmount in sync with the sum of its linked
// net-worth bucket(s) — supports one or many buckets per goal.
async function syncLinkedGoals(entries: { bucket: string; amount: number }[]) {
  const byBucket = new Map(entries.map((e) => [e.bucket, e.amount]));
  const goals = await db.goal.findMany({ where: { linkedBucket: { not: null } } });
  for (const g of goals) {
    const buckets = (g.linkedBucket ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (buckets.length === 0) continue;
    const sum = buckets.reduce((t, b) => t + (byBucket.get(b) ?? 0), 0);
    await db.goal.update({ where: { id: g.id }, data: { currentAmount: sum } });
  }
}
