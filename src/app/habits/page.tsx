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
import { votesByValue } from "@/lib/values";
import { cleanStreak, urgeStats, formatSince } from "@/lib/break-habits";

export const dynamic = "force-dynamic";

// How much history the heatmap shows (and bounds the log query).
const HISTORY_DAYS = 182; // ~26 weeks

export default async function HabitsPage() {
  const today = todayKey();
  const since = addDaysKey(today, -(HISTORY_DAYS - 1));

  const [habits, values, goals, slots, todayCheckinRaw] = await Promise.all([
    db.habit.findMany({
      where: { archived: false },
      orderBy: { sortOrder: "asc" },
      include: {
        logs: {
          where: { date: { gte: new Date(since + "T00:00:00.000Z") } },
          orderBy: { date: "asc" },
        },
        urges: { orderBy: { timestamp: "desc" } },
      },
    }),
    db.value.findMany({ orderBy: { sortOrder: "asc" } }),
    db.goal.findMany({ orderBy: { sortOrder: "asc" } }),
    getPageInsights("habits"),
    db.dailyCheckin.findFirst({ where: { date: new Date(today + "T00:00:00.000Z") } }),
  ]);

  const nowISO = new Date().toISOString();
  const dto: HabitDTO[] = habits.map((h) => {
    const logs = h.logs.map((l) => ({ date: dateKey(l.date), status: l.status }));
    const createdKey = dateKey(h.createdAt);
    const urges = h.urges.map((u) => ({ timestamp: u.timestamp.toISOString(), gaveIn: u.gaveIn }));
    const clean = cleanStreak(urges, h.createdAt.toISOString(), nowISO);
    const ustats = urgeStats(urges);
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
      rewardBundle: h.rewardBundle,
      goalId: h.goalId,
      valueId: h.valueId,
      logs,
      scheduledToday: isScheduledToday(h, logs, today),
      doneToday: doneOn(logs, today),
      streak: currentStreak(h, logs, today, createdKey),
      completionRate: completionRate(h, logs, today, 30, createdKey),
      missTwice: neverMissTwice(h, logs, today, createdKey),
      weekly: h.cadence === "weekly_count" ? weeklyProgress(h, logs, today) : null,
      breakClean: formatSince(clean),
      breakEverSlipped: clean.everSlipped,
      breakResistRate: ustats.resistRate,
      breakUrges: ustats.total,
    };
  });

  // Identity votes this week, grouped by the value each habit serves.
  const votes = votesByValue(
    dto.map((h) => ({ id: h.id, name: h.name, identityStatement: h.identityStatement, valueId: h.valueId, logs: h.logs })),
    values.map((v) => ({ id: v.id, name: v.name })),
    today,
  );

  return (
    <div>
      <PageHeader
        title="Habits"
        subtitle="Small votes for the person you want to become — check them off daily"
      />
      <InsightSlot insights={slots.habits} className="mb-5" />
      <HabitsClient
        habits={dto}
        today={today}
        historyDays={HISTORY_DAYS}
        votes={votes}
        values={values.map((v) => ({ id: v.id, name: v.name }))}
        goals={goals.map((g) => ({ id: g.id, name: g.name }))}
        todayCheckin={todayCheckinRaw ? {
          energy: todayCheckinRaw.energy,
          mood: todayCheckinRaw.mood,
          sleepHours: todayCheckinRaw.sleepHours,
          focusValueId: todayCheckinRaw.focusValueId,
        } : null}
      />
    </div>
  );
}
