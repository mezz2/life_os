import { describe, it, expect } from "vitest";
import {
  durationMin,
  eventsInWeek,
  timeByValue,
  formatMinutes,
  weekDayKeys,
  type EventLite,
} from "./calendar";

const ev = (over: Partial<EventLite> & { start: string; end: string }): EventLite => ({
  id: Math.random().toString(36).slice(2),
  title: "x",
  allDay: false,
  rigidity: "fixed",
  valueId: null,
  ...over,
});

describe("durationMin", () => {
  it("computes minutes between ISO times", () => {
    expect(durationMin("2026-06-10T09:00:00Z", "2026-06-10T10:30:00Z")).toBe(90);
  });
  it("is 0 for non-positive spans", () => {
    expect(durationMin("2026-06-10T10:00:00Z", "2026-06-10T09:00:00Z")).toBe(0);
  });
});

describe("eventsInWeek", () => {
  it("keeps only events in the Monday week of the given day", () => {
    const events = [
      ev({ start: "2026-06-08T09:00:00Z", end: "2026-06-08T10:00:00Z" }), // Mon, in week
      ev({ start: "2026-06-14T09:00:00Z", end: "2026-06-14T10:00:00Z" }), // Sun, in week
      ev({ start: "2026-06-15T09:00:00Z", end: "2026-06-15T10:00:00Z" }), // next Mon, out
      ev({ start: "2026-06-07T09:00:00Z", end: "2026-06-07T10:00:00Z" }), // prev Sun, out
    ];
    expect(eventsInWeek(events, "2026-06-10")).toHaveLength(2);
  });
});

describe("timeByValue", () => {
  const names = new Map([
    ["v1", "Health"],
    ["v2", "Craft"],
  ]);
  it("sums durations per value, sorted desc, untagged bucketed", () => {
    const events = [
      ev({ start: "2026-06-10T09:00:00Z", end: "2026-06-10T11:00:00Z", valueId: "v1" }), // 120
      ev({ start: "2026-06-10T12:00:00Z", end: "2026-06-10T12:30:00Z", valueId: "v1" }), // 30
      ev({ start: "2026-06-10T14:00:00Z", end: "2026-06-10T15:00:00Z", valueId: "v2" }), // 60
      ev({ start: "2026-06-10T16:00:00Z", end: "2026-06-10T16:45:00Z", valueId: null }), // 45 untagged
    ];
    expect(timeByValue(events, names)).toEqual([
      { valueId: "v1", name: "Health", minutes: 150 },
      { valueId: "v2", name: "Craft", minutes: 60 },
      { valueId: null, name: "Untagged", minutes: 45 },
    ]);
  });
  it("excludes all-day events (no duration)", () => {
    const events = [ev({ start: "2026-06-10T00:00:00Z", end: "2026-06-11T00:00:00Z", allDay: true, valueId: "v1" })];
    expect(timeByValue(events, names)).toEqual([]);
  });
});

describe("formatMinutes", () => {
  it("formats h/m combos", () => {
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(150)).toBe("2h 30m");
  });
});

describe("weekDayKeys", () => {
  it("returns Mon..Sun for the week of the given day", () => {
    expect(weekDayKeys("2026-06-10")).toEqual([
      "2026-06-08", "2026-06-09", "2026-06-10", "2026-06-11", "2026-06-12", "2026-06-13", "2026-06-14",
    ]);
  });
});
