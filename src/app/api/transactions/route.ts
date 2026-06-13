import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const where: Prisma.TransactionWhereInput = {};

  const month = p.get("month");
  if (month) {
    const [y, m] = month.split("-").map(Number);
    where.date = { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
  } else {
    const from = p.get("from");
    const to = p.get("to");
    if (from || to) {
      where.date = {};
      if (from) (where.date as Prisma.DateTimeFilter).gte = new Date(from + "T00:00:00Z");
      if (to) (where.date as Prisma.DateTimeFilter).lte = new Date(to + "T23:59:59Z");
    }
  }

  const accountId = p.get("accountId");
  if (accountId) where.accountId = accountId;

  const subcategoryId = p.get("subcategoryId");
  if (subcategoryId === "none") where.subcategoryId = null;
  else if (subcategoryId) where.subcategoryId = subcategoryId;

  const categoryId = p.get("categoryId");
  if (categoryId) where.subcategory = { categoryId };

  const type = p.get("type");
  if (type === "income") where.amount = { gt: 0 };
  else if (type === "expense") where.amount = { lt: 0 };

  if (p.get("needsReview") === "1") where.needsReview = true;

  const q = p.get("q");
  if (q) {
    where.OR = [
      { description: { contains: q } },
      { rawDescription: { contains: q } },
      { notes: { contains: q } },
    ];
  }

  const limit = Math.min(Number(p.get("limit") ?? 200), 1000);
  const offset = Number(p.get("offset") ?? 0);

  const [rows, total, agg] = await Promise.all([
    db.transaction.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
      include: {
        account: { select: { name: true, institution: true } },
        subcategory: { select: { id: true, name: true, category: { select: { name: true, kind: true } } } },
      },
    }),
    db.transaction.count({ where }),
    db.transaction.aggregate({ where, _sum: { amount: true } }),
  ]);

  return NextResponse.json({
    rows: rows.map((t) => ({
      id: t.id,
      date: t.date.toISOString().slice(0, 10),
      description: t.description,
      rawDescription: t.rawDescription,
      amount: t.amount,
      account: t.account.name,
      institution: t.account.institution,
      subcategoryId: t.subcategoryId,
      subcategory: t.subcategory?.name ?? null,
      category: t.subcategory?.category.name ?? null,
      kind: t.subcategory?.category.kind ?? null,
      needsReview: t.needsReview,
      notes: t.notes,
    })),
    total,
    sum: agg._sum.amount ?? 0,
  });
}

// Recategorise one or many transactions, optionally creating a learning rule.
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { ids, subcategoryId, applyToMatching, matchText, notes } = body as {
    ids: string[];
    subcategoryId?: string | null;
    applyToMatching?: boolean;
    matchText?: string;
    notes?: string;
  };

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "No transaction ids" }, { status: 400 });
  }

  const data: Prisma.TransactionUncheckedUpdateManyInput = {};
  if (subcategoryId !== undefined) {
    data.subcategoryId = subcategoryId;
    data.needsReview = false;
  }
  if (notes !== undefined) data.notes = notes;

  await db.transaction.updateMany({ where: { id: { in: ids } }, data });

  let ruleCreated = false;
  if (applyToMatching && subcategoryId && matchText && matchText.trim().length >= 2) {
    const pattern = matchText.trim().toLowerCase();
    const existing = await db.categoryRule.findFirst({ where: { pattern, matchType: "contains" } });
    if (existing) {
      await db.categoryRule.update({ where: { id: existing.id }, data: { subcategoryId, source: "user" } });
    } else {
      await db.categoryRule.create({
        data: { pattern, matchType: "contains", subcategoryId, priority: 50, source: "user" },
      });
    }
    ruleCreated = true;

    // Retro-apply to other uncategorised/matching transactions.
    const matches = await db.transaction.findMany({
      where: {
        id: { notIn: ids },
        OR: [{ description: { contains: pattern } }, { rawDescription: { contains: pattern } }],
      },
      select: { id: true },
    });
    if (matches.length) {
      await db.transaction.updateMany({
        where: { id: { in: matches.map((m) => m.id) } },
        data: { subcategoryId, needsReview: false },
      });
    }
    return NextResponse.json({ ok: true, ruleCreated, retroApplied: matches.length });
  }

  return NextResponse.json({ ok: true, ruleCreated });
}
