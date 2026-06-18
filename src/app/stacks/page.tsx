import { PageHeader } from "@/components/ui";
import { StacksClient, type StackDTO } from "@/components/StacksClient";
import { db } from "@/lib/db";
import { todayKey, keyToDate, dateKey } from "@/lib/habits";
import { orderChain } from "@/lib/stacks";

export const dynamic = "force-dynamic";

export default async function StacksPage() {
  const today = todayKey();
  const [stacks, habits, todaysLogs] = await Promise.all([
    db.habitStack.findMany({
      orderBy: { sortOrder: "asc" },
      include: { items: { include: { habit: { select: { id: true, name: true } } } } },
    }),
    db.habit.findMany({ where: { archived: false }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.habitLog.findMany({ where: { date: keyToDate(today), status: { in: ["done", "partial"] } }, select: { habitId: true, date: true } }),
  ]);

  const doneToday = new Set(todaysLogs.filter((l) => dateKey(l.date) === today).map((l) => l.habitId));

  const dto: StackDTO[] = stacks.map((s) => ({
    id: s.id,
    name: s.name,
    cue: s.cue,
    items: orderChain(s.items.map((it) => ({ habitId: it.habitId, order: it.order })))
      .map((it) => {
        const habit = s.items.find((x) => x.habitId === it.habitId)!.habit;
        return { habitId: it.habitId, name: habit.name, order: it.order, doneToday: doneToday.has(it.habitId) };
      }),
  }));

  return (
    <div>
      <PageHeader
        title="Routines"
        subtitle="Stack habits into chains — “After I ___, I will ___” — and run them in order"
      />
      <StacksClient stacks={dto} habits={habits} today={today} />
    </div>
  );
}
