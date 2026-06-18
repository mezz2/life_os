import { describe, it, expect } from "vitest";
import { goalPace, composeDigest, type DigestInput } from "./review";

describe("goalPace", () => {
  it("computes required weekly contribution", () => {
    // need 1000 more over 10 weeks -> 100/week
    const p = goalPace(0, 1000, "2026-08-24", "2026-06-15");
    expect(p).not.toBeNull();
    expect(p!.remaining).toBe(1000);
    expect(Math.round(p!.weeksLeft)).toBe(10);
    expect(Math.round(p!.requiredPerWeek)).toBe(100);
  });
  it("returns null without a target or date", () => {
    expect(goalPace(0, null, "2026-08-24", "2026-06-15")).toBeNull();
    expect(goalPace(0, 1000, null, "2026-06-15")).toBeNull();
  });
  it("clamps remaining at zero when already met", () => {
    const p = goalPace(1200, 1000, "2026-08-24", "2026-06-15");
    expect(p!.remaining).toBe(0);
  });
});

describe("composeDigest", () => {
  const base: DigestInput = {
    weekStartKey: "2026-06-08",
    habitsDone: 12,
    habitsDue: 18,
    votes: 12,
    topValue: { name: "Health", votes: 7 },
    trackedMinutes: 600,
    topTimeValue: { name: "Craft", minutes: 240 },
    avgEnergy: 3.6,
    topGoal: { name: "House deposit", pct: 0.42 },
  };

  it("produces a titled digest with all sections", () => {
    const d = composeDigest(base);
    expect(d.title).toBe("Week of 2026-06-08 – 2026-06-14");
    expect(d.lines[0]).toContain("12/18 completed (67%)");
    expect(d.lines.some((l) => l.includes("Health"))).toBe(true);
    expect(d.lines.some((l) => l.includes("Craft"))).toBe(true);
    expect(d.lines.some((l) => l.includes("3.6/5"))).toBe(true);
    expect(d.lines.some((l) => l.includes("42% there"))).toBe(true);
  });

  it("handles an empty week gracefully", () => {
    const d = composeDigest({
      weekStartKey: "2026-06-08",
      habitsDone: 0, habitsDue: 0, votes: 0,
      topValue: null, trackedMinutes: 0, topTimeValue: null, avgEnergy: null, topGoal: null,
    });
    expect(d.lines[0]).toContain("nothing was due");
    expect(d.lines).toHaveLength(1); // no votes/time/energy/goal lines
  });
});
