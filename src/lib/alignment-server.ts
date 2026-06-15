import { db } from "@/lib/db";
import { dateKey, todayKey, addDaysKey } from "@/lib/habits";
import { buildAlignment, type AlignmentReport } from "@/lib/alignment";

export const ALIGN_WINDOW_DAYS = 30;

// Gather the four LifeOS signals over a trailing window and build the per-Value
// alignment report. Shared by the /align page and the alignment insight rule.
export async function gatherAlignment(windowDays = ALIGN_WINDOW_DAYS): Promise<AlignmentReport> {
  const today = todayKey();
  const since = addDaysKey(today, -(windowDays - 1));
  const sinceDate = new Date(since + "T00:00:00.000Z");

  const [values, events, txns, logs, checkins] = await Promise.all([
    db.value.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.calendarEvent.findMany({
      where: { start: { gte: sinceDate } },
      select: { valueId: true, start: true, end: true },
    }),
    db.transaction.findMany({
      where: { date: { gte: sinceDate }, amount: { lt: 0 } },
      select: { amount: true, subcategory: { select: { valueId: true } } },
    }),
    db.habitLog.findMany({
      where: { date: { gte: sinceDate }, status: { in: ["done", "partial"] } },
      select: { date: true, habit: { select: { valueId: true } } },
    }),
    db.dailyCheckin.findMany({ where: { date: { gte: sinceDate } }, select: { date: true, energy: true } }),
  ]);

  const eventLites = events.map((e) => ({
    valueId: e.valueId,
    durationMin: Math.max(0, Math.round((e.end.getTime() - e.start.getTime()) / 60000)),
  }));
  const spendLites = txns.map((t) => ({ valueId: t.subcategory?.valueId ?? null, amount: Math.abs(t.amount) }));
  const completionLites = logs.map((l) => ({ valueId: l.habit.valueId, dateKey: dateKey(l.date) }));
  const energyByDay = new Map(checkins.map((c) => [dateKey(c.date), c.energy]));

  return buildAlignment(values, eventLites, spendLites, completionLites, energyByDay);
}
