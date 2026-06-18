import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Create a subcategory under a category.
export async function POST(req: NextRequest) {
  const { categoryId, name, group } = (await req.json()) as {
    categoryId?: string;
    name?: string;
    group?: string | null;
  };
  const n = (name ?? "").trim();
  if (!categoryId) return NextResponse.json({ error: "Missing category." }, { status: 400 });
  if (!n) return NextResponse.json({ error: "Subcategory name is required." }, { status: 400 });

  const g = group?.trim() || null;
  const clash = await db.subcategory.findFirst({ where: { categoryId, name: n } });
  if (clash) return NextResponse.json({ error: `"${n}" already exists in this category.` }, { status: 409 });

  const max = await db.subcategory.aggregate({ where: { categoryId }, _max: { sortOrder: true } });
  const sub = await db.subcategory.create({
    data: { name: n, group: g, categoryId, sortOrder: (max._max.sortOrder ?? -1) + 1 },
    select: { id: true, name: true, group: true, categoryId: true },
  });
  return NextResponse.json({ subcategory: sub });
}

// Rename / regroup a subcategory.
export async function PATCH(req: NextRequest) {
  const { id, name, group, valueId } = (await req.json()) as {
    id?: string;
    name?: string;
    group?: string | null;
    valueId?: string | null;
  };
  if (!id) return NextResponse.json({ error: "Missing subcategory id." }, { status: 400 });

  const data: { name?: string; group?: string | null; valueId?: string | null } = {};
  if (name !== undefined) {
    const n = name.trim();
    if (!n) return NextResponse.json({ error: "Subcategory name cannot be empty." }, { status: 400 });
    const current = await db.subcategory.findUnique({ where: { id }, select: { categoryId: true } });
    if (current) {
      const clash = await db.subcategory.findFirst({
        where: { categoryId: current.categoryId, name: n, id: { not: id } },
      });
      if (clash) return NextResponse.json({ error: `"${n}" already exists in this category.` }, { status: 409 });
    }
    data.name = n;
  }
  if (group !== undefined) data.group = group?.trim() || null;
  if (valueId !== undefined) data.valueId = valueId || null;

  await db.subcategory.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

// Delete a subcategory. Its budget line & rules cascade; transactions in it
// become uncategorised.
export async function DELETE(req: NextRequest) {
  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: "Missing subcategory id." }, { status: 400 });
  await db.subcategory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
