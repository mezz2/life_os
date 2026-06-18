import { db } from "@/lib/db";
import { dateKey, addDaysKey, isDueOn, startOfWeekKey, todayKey } from "@/lib/habits";
import { completionsThisWeek, votesByValue } from "@/lib/values";
import { timeByValue, type EventLite } from "@/lib/calendar";
import { composeDigest, type Digest, type DigestInput } from "@/lib/review";

// Count this week's due opportunities across cadences (weekly_count -> target).
function dueThisWeek(habit: { cadence: string; targetCount: number | null; weekdays: string | null }, weekStartKey: string): number {
  if (habit.cadence === "weekly_count") return Math.max(1, habit.targetCount ?? 1);
  let due = 0;
  for (let i = 0; i < 7; i++) if (isDueOn(habit, addDaysKey(weekStartKey, i))) due++;
  return due;
}

export async function buildWeeklyDigest(weekStartKey: string): Promise<Digest> {
  const today = todayKey();
  const weekEndKey = addDaysKey(weekStartKey, 7);
  const sinceDate = new Date(weekStartKey + "T00:00:00.000Z");
  const untilDate = new Date(weekEndKey + "T00:00:00.000Z");

  const [habits, values, events, checkins, goals] = await Promise.all([
    db.habit.findMany({
      where: { archived: false },
      include: { logs: { where: { date: { gte: sinceDate, lt: untilDate } } } },
    }),
    db.value.findMany({ orderBy: { sortOrder: "asc" } }),
    db.calendarEvent.findMany({ where: { start: { gte: sinceDate, lt: untilDate } } }),
    db.dailyCheckin.findMany({ where: { date: { gte: sinceDate, lt: untilDate } } }),
    db.goal.findMany({ where: { term: "short" }, orderBy: { sortOrder: "asc" } }),
  ]);

  let habitsDone = 0;
  let habitsDue = 0;
  const withLogs = habits.map((h) => {
    const logs = h.logs.map((l) => ({ date: dateKey(l.date), status: l.status }));
    if (h.type !== "break") {
      habitsDone += completionsThisWeek(logs, today);
      habitsDue += dueThisWeek(h, weekStartKey);
    }
    return { id: h.id, name: h.name, identityStatement: h.identityStatement, valueId: h.valueId, logs };
  });

  const votes = votesByValue(withLogs, values.map((v) => ({ id: v.id, name: v.name })), today);

  const lite: EventLite[] = events.map((e) => ({
    id: e.id, title: e.title, start: e.start.toISOString(), end: e.end.toISOString(), allDay: e.allDay, rigidity: e.rigidity, valueId: e.valueId,
  }));
  const byTime = timeByValue(lite, new Map(values.map((v) => [v.id, v.name])));
  const trackedMinutes = byTime.reduce((t, v) => t + v.minutes, 0);
  const topTimeValue = byTime.find((v) => v.valueId != null) ?? byTime[0] ?? null;

  const avgEnergy = checkins.length ? checkins.reduce((t, c) => t + c.energy, 0) / checkins.length : null;

  const topGoal = goals
    .filter((g) => g.targetAmount && g.targetAmount > 0)
    .map((g) => ({ name: g.name, pct: Math.min(1, g.currentAmount / g.targetAmount!) }))
    .sort((a, b) => b.pct - a.pct)[0] ?? null;

  const input: DigestInput = {
    weekStartKey,
    habitsDone,
    habitsDue,
    votes: votes.total,
    topValue: votes.byValue[0] ? { name: votes.byValue[0].name, votes: votes.byValue[0].votes } : null,
    trackedMinutes,
    topTimeValue: topTimeValue ? { name: topTimeValue.name, minutes: topTimeValue.minutes } : null,
    avgEnergy,
    topGoal,
  };
  return composeDigest(input);
}

export async function generateAndStore(anyDayKey?: string): Promise<{ digest: Digest; weekStart: string }> {
  const weekStart = startOfWeekKey(anyDayKey ?? todayKey());
  const digest = await buildWeeklyDigest(weekStart);
  await db.weeklyReview.upsert({
    where: { weekStart: new Date(weekStart + "T00:00:00.000Z") },
    create: { weekStart: new Date(weekStart + "T00:00:00.000Z"), title: digest.title, body: digest.lines.join("\n") },
    update: { title: digest.title, body: digest.lines.join("\n") },
  });
  return { digest, weekStart };
}
