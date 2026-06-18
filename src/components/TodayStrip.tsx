import Link from "next/link";
import { Repeat, CalendarDays, HeartHandshake, Vote, ArrowUpRight, CalendarRange } from "lucide-react";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { dateKey, todayKey, addDaysKey, isScheduledToday, doneOn } from "@/lib/habits";
import { votesByValue } from "@/lib/values";
import { activeSeason, seasonProgress, weeksRemaining } from "@/lib/seasons";

// The life-OS "Today" layer that sits atop the finance dashboard — a glanceable
// strip linking into habits, calendar and the daily check-in.
export async function TodayStrip() {
  const today = todayKey();
  const weekAgo = addDaysKey(today, -7);
  const dayStart = new Date(today + "T00:00:00.000Z");
  const dayEnd = new Date(addDaysKey(today, 1) + "T00:00:00.000Z");

  const [habits, values, todaysEvents, checkin, seasons] = await Promise.all([
    db.habit.findMany({
      where: { archived: false },
      include: { logs: { where: { date: { gte: new Date(weekAgo + "T00:00:00.000Z") } } } },
    }),
    db.value.findMany({ orderBy: { sortOrder: "asc" } }),
    db.calendarEvent.count({ where: { start: { gte: dayStart, lt: dayEnd } } }),
    db.dailyCheckin.findUnique({ where: { date: dayStart } }),
    db.season.findMany({ select: { id: true, name: true, theme: true, start: true, end: true } }),
  ]);

  const season = activeSeason(
    seasons.map((s) => ({ ...s, start: dateKey(s.start), end: dateKey(s.end) })),
    today,
  );

  const withLogs = habits.map((h) => ({
    ...h,
    logKeys: h.logs.map((l) => ({ date: dateKey(l.date), status: l.status })),
  }));
  const due = withLogs.filter((h) => h.type !== "break" && isScheduledToday(h, h.logKeys, today));
  const doneCount = due.filter((h) => doneOn(h.logKeys, today)).length;

  const votes = votesByValue(
    withLogs.map((h) => ({ id: h.id, name: h.name, identityStatement: h.identityStatement, valueId: h.valueId, logs: h.logKeys })),
    values.map((v) => ({ id: v.id, name: v.name })),
    today,
  );

  const tiles = [
    { href: "/habits", icon: Repeat, label: "Habits today", value: due.length ? `${doneCount}/${due.length}` : "—", sub: due.length ? "completed" : "none due" },
    { href: "/calendar", icon: CalendarDays, label: "On the calendar", value: String(todaysEvents), sub: "events today" },
    { href: "/checkin", icon: HeartHandshake, label: "Check-in", value: checkin ? `${checkin.energy}/5` : "—", sub: checkin ? "energy logged" : "not yet" },
    { href: "/habits", icon: Vote, label: "Votes this week", value: String(votes.total), sub: votes.byValue[0] ? `top: ${votes.byValue[0].name}` : "for your identity" },
  ];

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Today</div>
        <Link href="/review" className="text-xs flex items-center gap-1" style={{ color: "var(--color-accent)" }}>
          Weekly review <ArrowUpRight size={12} />
        </Link>
      </div>
      {season && (
        <Link href="/seasons" className="block mb-3">
          <Card className="transition-colors hover:border-[var(--color-accent)]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <CalendarRange size={15} style={{ color: "var(--color-accent)" }} />
                <span className="text-sm font-medium truncate">{season.name}</span>
                {season.theme && <span className="text-xs truncate hidden sm:inline" style={{ color: "var(--color-muted)" }}>· {season.theme}</span>}
              </div>
              <span className="num text-xs shrink-0" style={{ color: "var(--color-muted)" }}>
                {weeksRemaining(season, today)} {weeksRemaining(season, today) === 1 ? "wk" : "wks"} left
              </span>
            </div>
            <div className="mt-2 h-1 w-full rounded-full overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
              <div className="h-full rounded-full" style={{ width: `${Math.round(seasonProgress(season, today) * 100)}%`, background: "var(--color-accent)" }} />
            </div>
          </Card>
        </Link>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href}>
            <Card className="h-full transition-colors hover:border-[var(--color-accent)]">
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-muted)" }}>
                <t.icon size={14} /> {t.label}
              </div>
              <div className="num text-2xl font-semibold mt-2">{t.value}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>{t.sub}</div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
