import { PageHeader } from "@/components/ui";
import { InsightSlot } from "@/components/budget/InsightSlot";
import { AlignClient, type SubcatRow } from "@/components/AlignClient";
import { getPageInsights } from "@/lib/insights/store";
import { db } from "@/lib/db";
import { gatherAlignment, ALIGN_WINDOW_DAYS } from "@/lib/alignment-server";

export const dynamic = "force-dynamic";

export default async function AlignPage() {
  const [report, slots, values, expenseCats] = await Promise.all([
    gatherAlignment(),
    getPageInsights("align"),
    db.value.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.category.findMany({
      where: { kind: "expense" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, subcategories: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, valueId: true } } },
    }),
  ]);

  const subcats: SubcatRow[] = expenseCats.flatMap((c) =>
    c.subcategories.map((s) => ({ id: s.id, name: s.name, category: c.name, valueId: s.valueId })),
  );

  return (
    <div>
      <PageHeader
        title="Alignment"
        subtitle={`Time, money & energy per value over the last ${ALIGN_WINDOW_DAYS} days — does your week match what you say matters?`}
      />
      <InsightSlot insights={slots.align} className="mb-5" />
      <AlignClient report={report} values={values} subcats={subcats} windowDays={ALIGN_WINDOW_DAYS} />
    </div>
  );
}
