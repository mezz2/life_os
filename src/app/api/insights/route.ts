import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeInsights, type InsightDraft } from "@/lib/insights/rules";
import { composeNarrative } from "@/lib/insights/claude";
import { getMonthFlow, currentMonthKey } from "@/lib/queries";

// Regenerate all insights (rules + Claude narrative).
export async function POST() {
  const drafts = await computeInsights();

  // Cost floor: the narrative is the only paid (API) call. Skip it and reuse
  // the existing one unless this month's income/expense actually changed, so
  // repeated "Generate" presses on unchanged data cost nothing.
  const month = currentMonthKey();
  const flow = await getMonthFlow(month);
  const signature = `${month}:${Math.round(flow.income)}:${Math.round(flow.expense)}`;
  const prevNarrative = await db.insight.findFirst({
    where: { type: "narrative", dismissed: false },
    orderBy: { generatedAt: "desc" },
  });
  const prevSig = prevNarrative?.payload
    ? (JSON.parse(prevNarrative.payload) as { signature?: string }).signature
    : undefined;

  let narrative: InsightDraft | null;
  let regenerated = false;
  if (prevNarrative && prevSig === signature) {
    narrative = {
      period: month,
      type: "narrative",
      severity: "info",
      title: prevNarrative.title,
      body: prevNarrative.body,
      payload: { signature },
    };
  } else {
    narrative = await composeNarrative(drafts);
    if (narrative) narrative.payload = { signature };
    regenerated = !!narrative;
  }

  const all = narrative ? [narrative, ...drafts] : drafts;

  // Replace non-dismissed auto insights.
  await db.insight.deleteMany({ where: { dismissed: false } });
  if (all.length) {
    await db.insight.createMany({
      data: all.map((d) => ({
        period: d.period,
        type: d.type,
        severity: d.severity,
        title: d.title,
        body: d.body,
        payload: d.payload ? JSON.stringify(d.payload) : null,
      })),
    });
  }

  return NextResponse.json({
    ok: true,
    count: all.length,
    hasNarrative: !!narrative,
    narrativeRegenerated: regenerated,
  });
}

// Dismiss an insight.
export async function PATCH(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  await db.insight.update({ where: { id }, data: { dismissed: true } });
  return NextResponse.json({ ok: true });
}
