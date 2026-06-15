import { PageHeader } from "@/components/ui";
import { ValuesClient, type ValueDTO } from "@/components/ValuesClient";
import { db } from "@/lib/db";
import { dateKey, todayKey, addDaysKey, completionRate } from "@/lib/habits";
import { alignmentScore } from "@/lib/values";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 30;

export default async function ValuesPage() {
  const today = todayKey();
  const since = addDaysKey(today, -(WINDOW_DAYS - 1));

  const values = await db.value.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      goals: { orderBy: { sortOrder: "asc" } },
      habits: {
        where: { archived: false },
        include: {
          logs: { where: { date: { gte: new Date(since + "T00:00:00.000Z") } }, orderBy: { date: "asc" } },
        },
      },
    },
  });

  const dto: ValueDTO[] = values.map((v) => {
    const rates = v.habits.map((h) => {
      const logs = h.logs.map((l) => ({ date: dateKey(l.date), status: l.status }));
      const createdKey = dateKey(h.createdAt);
      return completionRate(h, logs, today, WINDOW_DAYS, createdKey);
    });
    return {
      id: v.id,
      name: v.name,
      description: v.description,
      alignment: alignmentScore(rates),
      habitCount: v.habits.length,
      goalCount: v.goals.length,
      habits: v.habits.map((h) => ({ id: h.id, name: h.name })),
      goals: v.goals.map((g) => ({ id: g.id, name: g.name })),
    };
  });

  return (
    <div>
      <PageHeader
        title="Values"
        subtitle="What you're optimising for — goals and habits roll up to these"
      />
      <ValuesClient values={dto} />
    </div>
  );
}
