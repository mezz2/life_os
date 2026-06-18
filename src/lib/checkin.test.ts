import { describe, it, expect } from "vitest";
import { pearson, energyVsCompletion, correlationLabel, type CheckinLite } from "./checkin";

describe("pearson", () => {
  it("is 1 for a perfect positive line", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 6);
  });
  it("is -1 for a perfect negative line", () => {
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 6);
  });
  it("is ~0 for uncorrelated data", () => {
    const r = pearson([1, 2, 3, 4], [3, 3, 3, 4]);
    expect(r).not.toBeNull();
    expect(Math.abs(r!)).toBeLessThan(0.9);
  });
  it("returns null with fewer than 2 points", () => {
    expect(pearson([1], [1])).toBeNull();
  });
  it("returns null when a series has no variance", () => {
    expect(pearson([2, 2, 2], [1, 2, 3])).toBeNull();
  });
});

describe("energyVsCompletion", () => {
  const checkins: CheckinLite[] = [
    { date: "2026-06-08", energy: 5, mood: 4 },
    { date: "2026-06-09", energy: 1, mood: 2 },
    { date: "2026-06-10", energy: 4, mood: 4 },
    { date: "2026-06-11", energy: 2, mood: 3 }, // no completion entry -> excluded
  ];
  it("pairs only days present in both series and correlates", () => {
    const comp = new Map([
      ["2026-06-08", 4],
      ["2026-06-09", 0],
      ["2026-06-10", 3],
    ]);
    const { r, n } = energyVsCompletion(checkins, comp);
    expect(n).toBe(3);
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(0.8); // high energy tracks with more completions
  });
  it("reports n=0 when nothing overlaps", () => {
    expect(energyVsCompletion(checkins, new Map())).toEqual({ r: null, n: 0 });
  });
});

describe("correlationLabel", () => {
  it("describes strength and direction", () => {
    expect(correlationLabel(0.75)).toBe("strong positive");
    expect(correlationLabel(-0.45)).toBe("moderate negative");
    expect(correlationLabel(0.1)).toBe("weak positive");
  });
});
