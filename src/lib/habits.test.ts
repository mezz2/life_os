import { describe, it, expect } from "vitest";
import {
  dateKey,
  keyToDate,
  addDaysKey,
  isDueOn,
  doneOn,
  weeklyProgress,
  isScheduledToday,
  currentStreak,
  completionRate,
  neverMissTwice,
  type HabitLite,
  type HabitLogLite,
} from "./habits";

// Helpers ---------------------------------------------------------------
const daily: HabitLite = { cadence: "daily", targetCount: null, weekdays: null };
// Mon/Wed/Fri (1,3,5)
const mwf: HabitLite = { cadence: "weekdays", targetCount: null, weekdays: "1,3,5" };
const thrice: HabitLite = { cadence: "weekly_count", targetCount: 3, weekdays: null };

// 2026-06-10 is a Wednesday; use it as a stable "today" anchor.
const WED = "2026-06-10";
const done = (...dates: string[]): HabitLogLite[] => dates.map((d) => ({ date: d, status: "done" }));
// Build N consecutive done-days ending at `end` (inclusive).
function run(end: string, n: number): HabitLogLite[] {
  return Array.from({ length: n }, (_, i) => ({ date: addDaysKey(end, -i), status: "done" }));
}

describe("date helpers", () => {
  it("roundtrips a key through a Date at UTC midnight", () => {
    expect(dateKey(keyToDate("2026-06-10"))).toBe("2026-06-10");
    expect(keyToDate("2026-06-10").getUTCHours()).toBe(0);
  });
  it("adds and subtracts days across month boundaries", () => {
    expect(addDaysKey("2026-06-30", 1)).toBe("2026-07-01");
    expect(addDaysKey("2026-07-01", -1)).toBe("2026-06-30");
  });
});

describe("isDueOn", () => {
  it("daily is always due", () => {
    expect(isDueOn(daily, WED)).toBe(true);
  });
  it("weekdays habit is due only on listed days", () => {
    expect(isDueOn(mwf, "2026-06-10")).toBe(true); // Wed
    expect(isDueOn(mwf, "2026-06-11")).toBe(false); // Thu
    expect(isDueOn(mwf, "2026-06-12")).toBe(true); // Fri
  });
  it("weekly_count can be done any day", () => {
    expect(isDueOn(thrice, "2026-06-11")).toBe(true);
  });
});

describe("doneOn / weeklyProgress", () => {
  it("detects a completion on a given day", () => {
    expect(doneOn(done("2026-06-10"), "2026-06-10")).toBe(true);
    expect(doneOn(done("2026-06-09"), "2026-06-10")).toBe(false);
  });
  it("counts completions in the Monday-anchored week", () => {
    // Week of Mon 2026-06-08 .. Sun 2026-06-14
    const logs = done("2026-06-08", "2026-06-10", "2026-06-14");
    expect(weeklyProgress(thrice, logs, WED)).toEqual({ done: 3, target: 3 });
    // a log in the previous week shouldn't count
    expect(weeklyProgress(thrice, done("2026-06-07"), WED)).toEqual({ done: 0, target: 3 });
  });
});

describe("isScheduledToday", () => {
  it("drops a weekly_count habit once its target is met (and not done today)", () => {
    const FRI = "2026-06-12";
    // 3 completions earlier this week (Mon/Tue/Wed), none on Friday -> drops off
    const met = done("2026-06-08", "2026-06-09", "2026-06-10");
    expect(isScheduledToday(thrice, met, FRI)).toBe(false);
    // only last week's completions -> still due this week
    expect(isScheduledToday(thrice, done("2026-06-06"), FRI)).toBe(true);
  });
  it("keeps it visible if the target was met *by* today's completion", () => {
    const logs = done("2026-06-08", "2026-06-09", "2026-06-10"); // 3rd is today
    expect(isScheduledToday(thrice, logs, WED)).toBe(true);
  });
  it("weekdays habit not scheduled on an off day", () => {
    expect(isScheduledToday(mwf, [], "2026-06-11")).toBe(false); // Thu
  });
});

describe("currentStreak (daily)", () => {
  it("counts a run ending today", () => {
    expect(currentStreak(daily, run(WED, 5), WED)).toBe(5);
  });
  it("gives a grace period for today not yet done", () => {
    // done through yesterday, today blank -> streak still counts yesterday's run
    expect(currentStreak(daily, run(addDaysKey(WED, -1), 4), WED)).toBe(4);
  });
  it("breaks when a day in the middle is missed", () => {
    const logs = done(WED, addDaysKey(WED, -1), addDaysKey(WED, -3)); // gap at -2
    expect(currentStreak(daily, logs, WED)).toBe(2);
  });
});

describe("currentStreak (weekdays) skips non-due days", () => {
  it("does not break over a weekend for a MWF habit", () => {
    // Fri 06-12, Wed 06-10, Mon 06-08 all done -> 3-week-day streak from Fri
    const logs = done("2026-06-08", "2026-06-10", "2026-06-12");
    expect(currentStreak(mwf, logs, "2026-06-12")).toBe(3);
  });
});

describe("currentStreak (weekly_count) counts weeks", () => {
  it("counts consecutive weeks meeting the target", () => {
    const logs = done(
      // this week (Mon 06-08..)
      "2026-06-08", "2026-06-09", "2026-06-10",
      // last week (Mon 06-01..)
      "2026-06-01", "2026-06-02", "2026-06-03",
    );
    expect(currentStreak(thrice, logs, WED)).toBe(2);
  });
  it("current incomplete week is a grace period, not a break", () => {
    const logs = done(
      "2026-06-08", // only 1 this week
      "2026-06-01", "2026-06-02", "2026-06-03", // last week met
    );
    expect(currentStreak(thrice, logs, WED)).toBe(1);
  });
});

describe("completionRate", () => {
  it("is 1.0 when every due day in the window is done", () => {
    expect(completionRate(daily, run(WED, 30), WED, 30)).toBeCloseTo(1, 5);
  });
  it("is ~0.5 for every other day", () => {
    const logs = Array.from({ length: 15 }, (_, i) => ({ date: addDaysKey(WED, -i * 2), status: "done" }));
    expect(completionRate(daily, logs, WED, 30)).toBeCloseTo(0.5, 1);
  });
  it("respects sinceKey so brand-new habits aren't penalised", () => {
    // created 3 days ago, done all 3 due days -> 100%, not diluted by empty history
    const since = addDaysKey(WED, -2);
    expect(completionRate(daily, run(WED, 3), WED, 30, since)).toBeCloseTo(1, 5);
  });
});

describe("neverMissTwice", () => {
  it("false when nothing missed", () => {
    expect(neverMissTwice(daily, run(WED, 5), WED)).toBe(false);
  });
  it("true after the two most recent elapsed due days were both missed", () => {
    // today blank (savable), yesterday & day-before missed
    const old = done(addDaysKey(WED, -5), addDaysKey(WED, -6));
    expect(neverMissTwice(daily, old, WED)).toBe(true);
  });
  it("false if only the single most recent day was missed", () => {
    const logs = done(addDaysKey(WED, -2)); // -1 missed, -2 done
    expect(neverMissTwice(daily, logs, WED)).toBe(false);
  });
  it("does not fire for a brand-new habit (sinceKey bounds it)", () => {
    const since = addDaysKey(WED, -1);
    expect(neverMissTwice(daily, [], WED, since)).toBe(false);
  });
});
