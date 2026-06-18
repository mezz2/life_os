import { describe, it, expect } from "vitest";
import { completionsThisWeek, votesByValue, alignmentScore, type HabitWithLinks } from "./values";

const WED = "2026-06-10"; // week of Mon 2026-06-08 .. Sun 2026-06-14
const log = (date: string, status = "done") => ({ date, status });

describe("completionsThisWeek", () => {
  it("counts only completions in the current Monday week", () => {
    const logs = [log("2026-06-08"), log("2026-06-10"), log("2026-06-07"), log("2026-06-10", "skipped")];
    expect(completionsThisWeek(logs, WED)).toBe(2); // 06-08, 06-10; 06-07 prev week, skipped ignored
  });
  it("is zero with no logs", () => {
    expect(completionsThisWeek([], WED)).toBe(0);
  });
});

describe("votesByValue", () => {
  const values = [
    { id: "v1", name: "Health" },
    { id: "v2", name: "Craft" },
  ];
  const habits: HabitWithLinks[] = [
    { id: "h1", name: "Gym", identityStatement: "I am fit", valueId: "v1", logs: [log("2026-06-08"), log("2026-06-10")] },
    { id: "h2", name: "Walk", identityStatement: null, valueId: "v1", logs: [log("2026-06-09")] },
    { id: "h3", name: "Write", identityStatement: "I am a writer", valueId: "v2", logs: [log("2026-06-10")] },
    { id: "h4", name: "Floss", identityStatement: null, valueId: null, logs: [log("2026-06-10")] },
  ];

  it("totals every completion this week (incl. unassigned)", () => {
    expect(votesByValue(habits, values, WED).total).toBe(5); // h1:2 + h2:1 + h3:1 + h4:1
  });
  it("groups votes by value and sorts by vote count desc", () => {
    const { byValue } = votesByValue(habits, values, WED);
    expect(byValue).toEqual([
      { valueId: "v1", name: "Health", votes: 3, habitCount: 2 },
      { valueId: "v2", name: "Craft", votes: 1, habitCount: 1 },
    ]);
  });
  it("omits values with no linked habits", () => {
    const { byValue } = votesByValue([habits[3]], values, WED);
    expect(byValue).toEqual([]);
  });
});

describe("alignmentScore", () => {
  it("averages the rates", () => {
    expect(alignmentScore([1, 0.5, 0])).toBeCloseTo(0.5, 5);
  });
  it("is null when a value has no habits", () => {
    expect(alignmentScore([])).toBeNull();
  });
});
