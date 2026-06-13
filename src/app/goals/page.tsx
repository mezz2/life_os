import { PageHeader } from "@/components/ui";
import { GoalsClient, type GoalDTO } from "@/components/GoalsClient";
import { InsightSlot } from "@/components/budget/InsightSlot";
import { getNetWorthBuckets } from "@/lib/queries";
import { getPageInsights } from "@/lib/insights/store";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const [goals, buckets, slots] = await Promise.all([
    db.goal.findMany({ orderBy: { sortOrder: "asc" } }),
    getNetWorthBuckets(),
    getPageInsights("goals"),
  ]);

  const dto: GoalDTO[] = goals.map((g) => ({
    id: g.id,
    name: g.name,
    term: g.term,
    targetAmount: g.targetAmount,
    currentAmount: g.currentAmount,
    targetDate: g.targetDate ? g.targetDate.toISOString().slice(0, 10) : null,
    linkedBuckets: g.linkedBucket ? g.linkedBucket.split(",").map((s) => s.trim()).filter(Boolean) : [],
    notes: g.notes,
  }));

  return (
    <div>
      <PageHeader title="Goals" subtitle="Short-term targets and long-term ambitions — click a goal to edit" />
      <InsightSlot insights={slots.goals} className="mb-5" />
      <GoalsClient goals={dto} buckets={buckets.map((b) => b.name)} />
    </div>
  );
}
