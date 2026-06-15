import { describe, it, expect } from "vitest";
import { lastSlip, timeSince, cleanStreak, urgeStats, formatSince, type UrgeLite } from "./break-habits";

const NOW = "2026-06-15T12:00:00Z";

describe("lastSlip", () => {
  it("returns the latest gaveIn timestamp", () => {
    const logs: UrgeLite[] = [
      { timestamp: "2026-06-10T08:00:00Z", gaveIn: true },
      { timestamp: "2026-06-12T08:00:00Z", gaveIn: false },
      { timestamp: "2026-06-13T08:00:00Z", gaveIn: true },
    ];
    expect(lastSlip(logs)).toBe("2026-06-13T08:00:00Z");
  });
  it("is null when never slipped", () => {
    expect(lastSlip([{ timestamp: NOW, gaveIn: false }])).toBeNull();
  });
});

describe("timeSince", () => {
  it("breaks elapsed time into days and hours", () => {
    expect(timeSince("2026-06-13T06:00:00Z", NOW)).toMatchObject({ days: 2, hours: 6 });
  });
  it("never goes negative", () => {
    expect(timeSince("2026-06-20T00:00:00Z", NOW).totalMinutes).toBe(0);
  });
});

describe("cleanStreak", () => {
  it("counts from the last slip when one exists", () => {
    const logs: UrgeLite[] = [{ timestamp: "2026-06-14T12:00:00Z", gaveIn: true }];
    const s = cleanStreak(logs, "2026-06-01T00:00:00Z", NOW);
    expect(s.everSlipped).toBe(true);
    expect(s.days).toBe(1); // slip 24h ago -> exactly 1 day clean
    expect(s.hours).toBe(0);
  });
  it("counts from creation when never slipped", () => {
    const s = cleanStreak([{ timestamp: NOW, gaveIn: false }], "2026-06-10T12:00:00Z", NOW);
    expect(s.everSlipped).toBe(false);
    expect(s.days).toBe(5);
  });
});

describe("urgeStats", () => {
  it("computes resist rate", () => {
    const logs: UrgeLite[] = [
      { timestamp: "a", gaveIn: false },
      { timestamp: "b", gaveIn: false },
      { timestamp: "c", gaveIn: true },
      { timestamp: "d", gaveIn: false },
    ];
    const s = urgeStats(logs);
    expect(s).toMatchObject({ total: 4, resisted: 3, gaveIn: 1 });
    expect(s.resistRate).toBeCloseTo(0.75, 5);
  });
  it("is zero-safe with no logs", () => {
    expect(urgeStats([])).toEqual({ total: 0, resisted: 0, gaveIn: 0, resistRate: 0 });
  });
});

describe("formatSince", () => {
  it("formats combos", () => {
    expect(formatSince({ days: 0, hours: 0 })).toBe("just now");
    expect(formatSince({ days: 0, hours: 5 })).toBe("5h");
    expect(formatSince({ days: 3, hours: 0 })).toBe("3d");
    expect(formatSince({ days: 2, hours: 6 })).toBe("2d 6h");
  });
});
