import { PageHeader } from "@/components/ui";
import { CheckinClient, type CheckinDTO } from "@/components/CheckinClient";
import { db } from "@/lib/db";
import { dateKey, todayKey, addDaysKey } from "@/lib/habits";
import { energyVsCompletion, correlationLabel } from "@/lib/checkin";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 30;

export default async function CheckinPage() {
  const today = todayKey();
  const sinceDate = new Date(addDaysKey(today, -(WINDOW_DAYS - 1)) + "T00:00:00.000Z");

  const [checkins, logs] = await Promise.all([
    db.dailyCheckin.findMany({ where: { date: { gte: sinceDate } }, orderBy: { date: "asc" } }),
    db.habitLog.findMany({
      where: { date: { gte: sinceDate }, status: { in: ["done", "partial"] } },
      select: { date: true },
    }),
  ]);

  const history: CheckinDTO[] = checkins.map((c) => ({
    date: dateKey(c.date),
    energy: c.energy,
    mood: c.mood,
    sleepHours: c.sleepHours,
    note: c.note,
  }));
  const todayCheckin = history.find((c) => c.date === today) ?? null;

  // Completions per day -> correlate with self-reported energy.
  const completionsByDate = new Map<string, number>();
  for (const l of logs) {
    const k = dateKey(l.date);
    completionsByDate.set(k, (completionsByDate.get(k) ?? 0) + 1);
  }
  const { r, n } = energyVsCompletion(
    history.map((c) => ({ date: c.date, energy: c.energy, mood: c.mood })),
    completionsByDate,
  );
  // Only surface a correlation once there's a meaningful sample.
  const correlation =
    r != null && n >= 5 ? { r, n, label: correlationLabel(r) } : null;

  return (
    <div>
      <PageHeader
        title="Daily check-in"
        subtitle="Energy, mood and sleep — the hidden variable behind everything else"
      />
      <CheckinClient
        today={today}
        todayCheckin={todayCheckin}
        history={history}
        correlation={correlation}
      />
    </div>
  );
}
