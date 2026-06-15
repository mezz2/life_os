import { PageHeader } from "@/components/ui";
import { CalendarClient, type CalEventDTO } from "@/components/CalendarClient";
import { db } from "@/lib/db";
import { todayKey, startOfWeekKey, addDaysKey, dateKey } from "@/lib/habits";
import { timeByValue, type EventLite } from "@/lib/calendar";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const sp = await searchParams;
  // `week` is any day in the target week; default to this week.
  const anchor = sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : todayKey();
  const weekStart = startOfWeekKey(anchor);
  const weekEnd = addDaysKey(weekStart, 7); // exclusive

  const [events, values] = await Promise.all([
    db.calendarEvent.findMany({
      where: {
        start: { gte: new Date(weekStart + "T00:00:00.000Z"), lt: new Date(weekEnd + "T00:00:00.000Z") },
      },
      orderBy: { start: "asc" },
    }),
    db.value.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const dto: CalEventDTO[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start.toISOString(),
    end: e.end.toISOString(),
    allDay: e.allDay,
    rigidity: e.rigidity,
    valueId: e.valueId,
    goalId: e.goalId,
    dayKey: dateKey(e.start),
  }));

  const valueNames = new Map(values.map((v) => [v.id, v.name]));
  const lite: EventLite[] = dto.map((e) => ({
    id: e.id, title: e.title, start: e.start, end: e.end, allDay: e.allDay, rigidity: e.rigidity, valueId: e.valueId,
  }));
  const byValue = timeByValue(lite, valueNames);

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="Where your week actually goes — tag events to a value to see the breakdown"
      />
      <CalendarClient
        weekStart={weekStart}
        prevWeek={addDaysKey(weekStart, -7)}
        nextWeek={addDaysKey(weekStart, 7)}
        today={todayKey()}
        events={dto}
        byValue={byValue}
        values={values.map((v) => ({ id: v.id, name: v.name }))}
      />
    </div>
  );
}
