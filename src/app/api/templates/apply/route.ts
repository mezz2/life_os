import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBlocks } from "@/lib/seasons";

// Materialise a week template into real TimeBlock rows (the "apply default week"
// action). mode "append" adds them alongside existing blocks; "replace" clears
// all current TimeBlocks first so the week is exactly the template.
export async function POST(req: NextRequest) {
  const { templateId, mode } = (await req.json()) as { templateId?: string; mode?: "append" | "replace" };
  if (!templateId) return NextResponse.json({ error: "templateId required" }, { status: 400 });

  const tpl = await db.weekTemplate.findUnique({ where: { id: templateId } });
  if (!tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const specs = parseBlocks(tpl.blocks);
  if (specs.length === 0) return NextResponse.json({ error: "Template has no blocks" }, { status: 400 });

  await db.$transaction(async (tx) => {
    if (mode === "replace") await tx.timeBlock.deleteMany({});
    await tx.timeBlock.createMany({ data: specs });
  });

  return NextResponse.json({ ok: true, created: specs.length });
}
