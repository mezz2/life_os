import { PageHeader } from "@/components/ui";
import { HabitsClient, type HabitDTO } from "@/components/HabitsClient";
import { InsightSlot } from "@/components/budget/InsightSlot";
import { getPageInsights } from "@/lib/insights/store";
import { db } from "@/lib/db";
import {
  dateKey,
  todayKey,
  addDaysKey,
  isScheduledToday,
  doneOn,
  currentStreak,
  completionRate,
  neverMissTwice,
  weeklyProgress,
} from "@/lib/habits";

export const dynamic = "force-dynamic";

// How much history the heatmap shows (and bounds the log query).
const HISTORY_DAYS = 182; // ~26 weeks

export default async function HabitsPage() {
  const today = todayKey();
  const since = addDaysKey(today, -(HISTORY_DAYS - 1));

  const [habits, slots] = await Promise.all([
    db.habit.findMany({
      where: { archived: false },
      orderBy: { sortOrder: "asc" },
      include: {
        logs: {
          where: { date: { gte: new Date(since + "T00:00:00.000Z") } },
          orderBy: { date: "asc" },
        },
      },
    }),
    getPageInsights("habits"),
  ]);

  const dto: HabitDTO[] = habits.map((h) => {
    const logs = h.logs.map((l) => ({ date: dateKey(l.date), status: l.status }));
    const createdKey = dateKey(h.createdAt);
    return {
      id: h.id,
      name: h.name,
      identityStatement: h.identityStatement,
      type: h.type,
      cadence: h.cadence,
      targetCount: h.targetCount,
      weekdays: h.weekdays,
      cue: h.cue,
      craving: h.craving,
      response: h.response,
      reward: h.reward,
      twoMinVersion: h.twoMinVersion,
      logs,
      scheduledToday: isScheduledToday(h, logs, today),
      doneToday: doneOn(logs, today),
      streak: currentStreak(h, logs, today, createdKey),
      completionRate: completionRate(h, logs, today, 30, createdKey),
      missTwice: neverMissTwice(h, logs, today, createdKey),
      weekly: h.cadence === "weekly_count" ? weeklyProgress(h, logs, today) : null,
    };
  });

  return (
    <div>
      <PageHeader
        title="Habits"
        subtitle="Small votes for the person you want to become — check them off daily"
      />
      <InsightSlot insights={slots.habits} className="mb-5" />
      <HabitsClient habits={dto} today={today} historyDays={HISTORY_DAYS} />
    </div>
  );
}
