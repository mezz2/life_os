import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeBlocks, normaliseBlockSpec, type BlockSpec } from "@/lib/seasons";

type TemplateInput = {
  id?: string;
  name?: string;
  blocks?: Partial<BlockSpec>[];
  fromCurrent?: boolean; // snapshot the live TimeBlock rows instead of `blocks`
};

// Read the current TimeBlock rows as template specs (the "save current week").
async function currentBlocksAsSpecs(): Promise<BlockSpec[]> {
  const blocks = await db.timeBlock.findMany({ orderBy: { priority: "asc" } });
  return blocks.map((b) =>
    normaliseBlockSpec({
      title: b.title,
      rigidity: b.rigidity,
      durationMin: b.durationMin,
      minChunkMin: b.minChunkMin,
      energy: b.energy,
      days: b.days,
      startMin: b.startMin,
      endMin: b.endMin,
      theme: b.theme,
      priority: b.priority,
      habitId: b.habitId,
    }),
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as TemplateInput;
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const specs = body.fromCurrent
    ? await currentBlocksAsSpecs()
    : Array.isArray(body.blocks)
      ? body.blocks.map(normaliseBlockSpec)
      : [];
  if (specs.length === 0) return NextResponse.json({ error: "No blocks to save" }, { status: 400 });
  const max = await db.weekTemplate.aggregate({ _max: { sortOrder: true } });
  const tpl = await db.weekTemplate.create({
    data: { name, blocks: serializeBlocks(specs), sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  return NextResponse.json({ ok: true, id: tpl.id });
}

// Rename a template (its blocks are refreshed by re-saving the current week).
export async function PUT(req: NextRequest) {
  const body = (await req.json()) as TemplateInput;
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  await db.weekTemplate.update({ where: { id: body.id }, data: { name } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.weekTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
