import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Upsert a monthly budget line for a subcategory. BudgetLine has no unique
// index on subcategoryId, so update-then-create rather than prisma upsert.
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { subcategoryId, projectedAmount } = body as {
    subcategoryId?: string;
    projectedAmount?: number;
  };
  if (!subcategoryId || typeof projectedAmount !== "number" || Number.isNaN(projectedAmount)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const updated = await db.budgetLine.updateMany({
    where: { subcategoryId, periodType: "monthly" },
    data: { projectedAmount },
  });
  if (updated.count === 0) {
    await db.budgetLine.create({
      data: { subcategoryId, periodType: "monthly", projectedAmount },
    });
  }
  return NextResponse.json({ ok: true });
}

// Remove the monthly budget line(s) for a subcategory.
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { subcategoryId } = body as { subcategoryId?: string };
  if (!subcategoryId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  await db.budgetLine.deleteMany({ where: { subcategoryId, periodType: "monthly" } });
  return NextResponse.json({ ok: true });
}
