import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const KINDS = new Set(["income", "expense", "transfer", "investment"]);

// Create a top-level category.
export async function POST(req: NextRequest) {
  const { name, kind } = (await req.json()) as { name?: string; kind?: string };
  const n = (name ?? "").trim();
  if (!n) return NextResponse.json({ error: "Category name is required." }, { status: 400 });
  if (!kind || !KINDS.has(kind)) {
    return NextResponse.json({ error: "Pick a valid kind (income/expense/transfer/investment)." }, { status: 400 });
  }

  const existing = await db.category.findUnique({ where: { name: n } });
  if (existing) return NextResponse.json({ error: `A category named "${n}" already exists.` }, { status: 409 });

  const max = await db.category.aggregate({ _max: { sortOrder: true } });
  const category = await db.category.create({
    data: { name: n, kind, sortOrder: (max._max.sortOrder ?? -1) + 1 },
    select: { id: true, name: true, kind: true, sortOrder: true },
  });
  return NextResponse.json({ category });
}

// Rename / change kind of a category.
export async function PATCH(req: NextRequest) {
  const { id, name, kind } = (await req.json()) as { id?: string; name?: string; kind?: string };
  if (!id) return NextResponse.json({ error: "Missing category id." }, { status: 400 });

  const data: { name?: string; kind?: string } = {};
  if (name !== undefined) {
    const n = name.trim();
    if (!n) return NextResponse.json({ error: "Category name cannot be empty." }, { status: 400 });
    const clash = await db.category.findFirst({ where: { name: n, id: { not: id } } });
    if (clash) return NextResponse.json({ error: `A category named "${n}" already exists.` }, { status: 409 });
    data.name = n;
  }
  if (kind !== undefined) {
    if (!KINDS.has(kind)) return NextResponse.json({ error: "Invalid kind." }, { status: 400 });
    data.kind = kind;
  }

  await db.category.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

// Delete a category. Subcategories (and their budget lines & rules) cascade;
// transactions in those subcategories become uncategorised.
export async function DELETE(req: NextRequest) {
  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: "Missing category id." }, { status: 400 });
  await db.category.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
