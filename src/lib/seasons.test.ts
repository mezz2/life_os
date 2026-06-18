import { describe, it, expect } from "vitest";
import {
  daysBetween,
  seasonWeeks,
  isActiveOn,
  activeSeason,
  seasonProgress,
  weeksRemaining,
  parseGoalIds,
  serializeGoalIds,
  normaliseBlockSpec,
  parseBlocks,
  serializeBlocks,
  templateMinutes,
} from "./seasons";

describe("daysBetween", () => {
  it("is inclusive of both ends", () => {
    expect(daysBetween("2026-01-01", "2026-01-01")).toBe(1);
    expect(daysBetween("2026-01-01", "2026-01-07")).toBe(7);
  });
  it("is 0 when end precedes start", () => {
    expect(daysBetween("2026-01-07", "2026-01-01")).toBe(0);
  });
});

describe("seasonWeeks", () => {
  it("rounds to whole weeks, min 1", () => {
    expect(seasonWeeks({ start: "2026-01-01", end: "2026-02-25" })).toBe(8); // 56 days
    expect(seasonWeeks({ start: "2026-01-01", end: "2026-01-01" })).toBe(1);
  });
});

describe("isActiveOn / activeSeason", () => {
  const wide = { id: "w", start: "2026-01-01", end: "2026-12-31" };
  const narrow = { id: "n", start: "2026-06-01", end: "2026-06-30" };

  it("matches dates within the window inclusively", () => {
    expect(isActiveOn(wide, "2026-01-01")).toBe(true);
    expect(isActiveOn(wide, "2026-12-31")).toBe(true);
    expect(isActiveOn(wide, "2025-12-31")).toBe(false);
  });
  it("prefers the shortest containing season", () => {
    expect(activeSeason([wide, narrow], "2026-06-15")?.id).toBe("n");
    expect(activeSeason([wide, narrow], "2026-03-15")?.id).toBe("w");
  });
  it("returns null when nothing is active", () => {
    expect(activeSeason([narrow], "2026-01-01")).toBeNull();
  });
});

describe("seasonProgress", () => {
  const s = { start: "2026-01-01", end: "2026-01-10" }; // 10 days
  it("is 0 before/at start and 1 at end", () => {
    expect(seasonProgress(s, "2025-12-01")).toBe(0);
    expect(seasonProgress(s, "2026-01-10")).toBe(1);
  });
  it("is proportional mid-season", () => {
    expect(seasonProgress(s, "2026-01-05")).toBeCloseTo(0.5, 1);
  });
  it("clamps past the end", () => {
    expect(seasonProgress(s, "2026-02-01")).toBe(1);
  });
});

describe("weeksRemaining", () => {
  const s = { start: "2026-01-01", end: "2026-01-28" };
  it("counts whole weeks left from a mid-point", () => {
    expect(weeksRemaining(s, "2026-01-15")).toBe(2);
  });
  it("is 0 once past the end", () => {
    expect(weeksRemaining(s, "2026-02-01")).toBe(0);
  });
  it("uses the full length before it starts", () => {
    expect(weeksRemaining(s, "2025-12-01")).toBe(4);
  });
});

describe("goalIds CSV", () => {
  it("round-trips and dedupes", () => {
    expect(parseGoalIds("a, b ,a")).toEqual(["a", "b", "a"]);
    expect(serializeGoalIds(["a", "b", "a", "  "])).toBe("a,b");
    expect(serializeGoalIds([])).toBeNull();
    expect(parseGoalIds(null)).toEqual([]);
  });
});

describe("block specs", () => {
  it("coerces bad input to safe defaults", () => {
    const b = normaliseBlockSpec({ title: " Gym ", rigidity: "bogus", durationMin: 0, energy: "x" });
    expect(b.title).toBe("Gym");
    expect(b.rigidity).toBe("flexible");
    expect(b.durationMin).toBe(30);
    expect(b.energy).toBe("any");
  });
  it("round-trips through serialize/parse, dropping untitled", () => {
    const specs = [normaliseBlockSpec({ title: "Read", durationMin: 30 }), normaliseBlockSpec({ title: "" })];
    const blob = serializeBlocks(specs);
    const back = parseBlocks(blob);
    expect(back).toHaveLength(1);
    expect(back[0].title).toBe("Read");
  });
  it("parseBlocks tolerates garbage", () => {
    expect(parseBlocks("not json")).toEqual([]);
    expect(parseBlocks(null)).toEqual([]);
    expect(parseBlocks("{}")).toEqual([]);
  });
});

describe("templateMinutes", () => {
  it("multiplies a spec by its day count", () => {
    const specs = [
      normaliseBlockSpec({ title: "A", durationMin: 60, days: "1,3,5" }),
      normaliseBlockSpec({ title: "B", durationMin: 30 }),
    ];
    expect(templateMinutes(specs)).toBe(60 * 3 + 30);
  });
});
