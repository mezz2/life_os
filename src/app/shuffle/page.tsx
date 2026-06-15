import { PageHeader } from "@/components/ui";
import { ShuffleClient, type TimeBlockDTO } from "@/components/ShuffleClient";
import { db } from "@/lib/db";
import { todayKey, startOfWeekKey } from "@/lib/habits";

export const dynamic = "force-dynamic";

export default async function ShufflePage() {
  const [blocks, habits] = await Promise.all([
    db.timeBlock.findMany({ orderBy: { priority: "asc" } }),
    db.habit.findMany({ where: { archived: false }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  const dto: TimeBlockDTO[] = blocks.map((b) => ({
    id: b.id,
    title: b.title,
    rigidity: b.rigidity,
    durationMin: b.durationMin,
    minChunkMin: b.minChunkMin,
    energy: b.energy,
    days: b.days,
    startMin: b.startMin,
    endMin: b.endMin,
    priority: b.priority,
    habitId: b.habitId,
  }));

  return (
    <div>
      <PageHeader
        title="Shuffle"
        subtitle="Reflow your flexible blocks around fixed commitments — propose, review the diff, then apply"
      />
      <ShuffleClient
        weekStart={startOfWeekKey(todayKey())}
        blocks={dto}
        habits={habits}
      />
    </div>
  );
}
