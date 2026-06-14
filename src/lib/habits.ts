// Habit engine — pure, cadence-aware helpers shared by the /habits page and
// (later) habit insight rules. All date maths is in UTC, keyed by "YYYY-MM-DD"
// to match how HabitLog rows are normalised (UTC midnight). No DB access here.

export type HabitCadence = "daily" | "weekly_count" | "weekdays";

// Minimal shapes — work for both Prisma rows and DTOs.
export type HabitLite = {
  cadence: string;
  targetCount: number | null;
  weekdays: string | null; // CSV of 0-6 (Sun..Sat)
};

export type HabitLogLite = {
  date: string; // YYYY-MM-DD
  status: string; // done | partial | skipped
};

const DAY_MS = 86_400_000;

export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayKey(): string {
  return dateKey(new Date());
}

// Midnight-UTC Date for a YYYY-MM-DD key — used when persisting logs.
export function keyToDate(key: string): Date {
  return new Date(key + "T00:00:00.000Z");
}

export function addDaysKey(key: string, n: number): string {
  return dateKey(new Date(keyToDate(key).getTime() + n * DAY_MS));
}

function weekdayOf(key: string): number {
  return keyToDate(key).getUTCDay(); // 0=Sun..6=Sat
}

// Monday-anchored week start, so weekly_count cadences roll on Mondays.
function startOfWeekKey(key: string): string {
  const offset = (weekdayOf(key) + 6) % 7; // days since Monday
  return addDaysKey(key, -offset);
}

function isCompletion(status: string): boolean {
  return status === "done" || status === "partial";
}

function parseWeekdays(csv: string | null): Set<number> {
  if (!csv) return new Set();
  return new Set(
    csv
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
  );
}

function completionKeys(logs: HabitLogLite[]): Set<string> {
  return new Set(logs.filter((l) => isCompletion(l.status)).map((l) => l.date));
}

// Is the habit structurally scheduled on this calendar day? (Ignores logs.)
// weekly_count habits can be done on any day, so they're always "on".
export function isDueOn(habit: HabitLite, key: string): boolean {
  if (habit.cadence === "weekdays") {
    const wd = parseWeekdays(habit.weekdays);
    return wd.size === 0 ? true : wd.has(weekdayOf(key));
  }
  return true; // daily | weekly_count
}

export function doneOn(logs: HabitLogLite[], key: string): boolean {
  return logs.some((l) => l.date === key && isCompletion(l.status));
}

// Completions logged in the current (Monday-anchored) week vs the target.
export function weeklyProgress(
  habit: HabitLite,
  logs: HabitLogLite[],
  todayK: string,
): { done: number; target: number } {
  const target = Math.max(1, habit.targetCount ?? 1);
  const week = startOfWeekKey(todayK);
  const done = logs.filter(
    (l) => isCompletion(l.status) && startOfWeekKey(l.date) === week,
  ).length;
  return { done, target };
}

// Should this habit appear in the "due today" list? For weekly_count it drops
// off once the weekly target is met (unless it was the thing completed today,
// so the user still sees the satisfying checked state).
export function isScheduledToday(
  habit: HabitLite,
  logs: HabitLogLite[],
  todayK: string,
): boolean {
  if (!isDueOn(habit, todayK)) return false;
  if (habit.cadence === "weekly_count") {
    const { done, target } = weeklyProgress(habit, logs, todayK);
    if (done >= target && !doneOn(logs, todayK)) return false;
  }
  return true;
}

// Consecutive completed periods up to today. Days for daily/weekdays (non-due
// days are skipped, not broken on); weeks for weekly_count. The current,
// not-yet-completed period is a grace period — it doesn't reset the streak.
export function currentStreak(
  habit: HabitLite,
  logs: HabitLogLite[],
  todayK: string,
  sinceKey?: string,
): number {
  if (habit.cadence === "weekly_count") return weeklyStreak(habit, logs, todayK, sinceKey);

  const done = completionKeys(logs);
  let key = todayK;
  if (isDueOn(habit, key) && !done.has(key)) key = addDaysKey(key, -1); // grace for today
  let streak = 0;
  for (let i = 0; i < 3660; i++) {
    if (sinceKey && key < sinceKey) break;
    if (isDueOn(habit, key)) {
      if (done.has(key)) streak++;
      else break;
    }
    key = addDaysKey(key, -1);
  }
  return streak;
}

function weeklyStreak(
  habit: HabitLite,
  logs: HabitLogLite[],
  todayK: string,
  sinceKey?: string,
): number {
  const target = Math.max(1, habit.targetCount ?? 1);
  const perWeek = new Map<string, number>();
  for (const l of logs) {
    if (!isCompletion(l.status)) continue;
    const ws = startOfWeekKey(l.date);
    perWeek.set(ws, (perWeek.get(ws) ?? 0) + 1);
  }
  let ws = startOfWeekKey(todayK);
  if ((perWeek.get(ws) ?? 0) < target) ws = addDaysKey(ws, -7); // grace for current week
  const floor = sinceKey ? startOfWeekKey(sinceKey) : undefined;
  let streak = 0;
  for (let i = 0; i < 520; i++) {
    if (floor && ws < floor) break;
    if ((perWeek.get(ws) ?? 0) >= target) {
      streak++;
      ws = addDaysKey(ws, -7);
    } else break;
  }
  return streak;
}

// Share of due opportunities completed over a trailing window (0..1).
export function completionRate(
  habit: HabitLite,
  logs: HabitLogLite[],
  todayK: string,
  windowDays = 30,
  sinceKey?: string,
): number {
  if (habit.cadence === "weekly_count") {
    const target = Math.max(1, habit.targetCount ?? 1);
    const weeks = Math.max(1, Math.round(windowDays / 7));
    const startKey = addDaysKey(todayK, -(weeks * 7 - 1));
    const lower = sinceKey && sinceKey > startKey ? sinceKey : startKey;
    const completions = logs.filter(
      (l) => isCompletion(l.status) && l.date >= lower && l.date <= todayK,
    ).length;
    return Math.min(1, completions / (weeks * target));
  }

  const done = completionKeys(logs);
  let key = todayK;
  let due = 0;
  let hit = 0;
  for (let i = 0; i < windowDays; i++) {
    if (sinceKey && key < sinceKey) break;
    if (isDueOn(habit, key)) {
      due++;
      if (done.has(key)) hit++;
    }
    key = addDaysKey(key, -1);
  }
  return due === 0 ? 0 : hit / due;
}

// "Never miss twice": true once the two most recent *elapsed* due opportunities
// (before today — today can still be saved) were both missed. Bounded by the
// habit's creation so brand-new habits don't nag.
export function neverMissTwice(
  habit: HabitLite,
  logs: HabitLogLite[],
  todayK: string,
  sinceKey?: string,
): boolean {
  if (habit.cadence === "weekly_count") {
    const target = Math.max(1, habit.targetCount ?? 1);
    const perWeek = new Map<string, number>();
    for (const l of logs) {
      if (!isCompletion(l.status)) continue;
      const ws = startOfWeekKey(l.date);
      perWeek.set(ws, (perWeek.get(ws) ?? 0) + 1);
    }
    const w1 = addDaysKey(startOfWeekKey(todayK), -7);
    const w2 = addDaysKey(startOfWeekKey(todayK), -14);
    if (sinceKey && w2 < startOfWeekKey(sinceKey)) return false;
    return (perWeek.get(w1) ?? 0) < target && (perWeek.get(w2) ?? 0) < target;
  }

  const done = completionKeys(logs);
  const due: string[] = [];
  let key = addDaysKey(todayK, -1);
  for (let i = 0; i < 3660 && due.length < 2; i++) {
    if (sinceKey && key < sinceKey) break;
    if (isDueOn(habit, key)) due.push(key);
    key = addDaysKey(key, -1);
  }
  if (due.length < 2) return false;
  return !done.has(due[0]) && !done.has(due[1]);
}
