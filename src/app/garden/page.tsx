import { PageHeader } from "@/components/ui";
import { GardenClient, type ReferenceDTO } from "@/components/GardenClient";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function GardenPage() {
  const [refs, values, goals] = await Promise.all([
    db.reference.findMany({
      orderBy: { createdAt: "desc" },
      include: { value: { select: { name: true } }, goal: { select: { name: true } } },
    }),
    db.value.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.goal.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  const dto: ReferenceDTO[] = refs.map((r) => ({
    id: r.id,
    title: r.title,
    url: r.url,
    source: r.source,
    note: r.note,
    valueId: r.valueId,
    valueName: r.value?.name ?? null,
    goalId: r.goalId,
    goalName: r.goal?.name ?? null,
  }));

  return (
    <div>
      <PageHeader
        title="Knowledge garden"
        subtitle="A local cache of what you're learning — articles, talks and papers that roll up to a value or goal"
      />
      <GardenClient references={dto} values={values} goals={goals} />
    </div>
  );
}
