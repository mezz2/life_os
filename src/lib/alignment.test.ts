import { describe, it, expect } from "vitest";
import { buildAlignment, alignmentScore, topMismatch, type ValueRef } from "./alignment";

const values: ValueRef[] = [
  { id: "health", name: "Health" },
  { id: "craft", name: "Craft" },
];

describe("buildAlignment", () => {
  it("aggregates time/money/votes per value and tracks unattributed", () => {
    const r = buildAlignment(
      values,
      [
        { valueId: "health", durationMin: 60 },
        { valueId: "craft", durationMin: 120 },
        { valueId: null, durationMin: 30 }, // untagged event
      ],
      [
        { valueId: "health", amount: 200 },
        { valueId: null, amount: 50 },
      ],
      [
        { valueId: "health", dateKey: "2026-06-01" },
        { valueId: "health", dateKey: "2026-06-02" },
        { valueId: "craft", dateKey: "2026-06-01" },
      ],
      new Map([["2026-06-01", 4], ["2026-06-02", 2]]),
    );

    const health = r.values.find((v) => v.id === "health")!;
    expect(health.minutes).toBe(60);
    expect(health.money).toBe(200);
    expect(health.votes).toBe(2);
    expect(health.activeDays).toBe(2);
    expect(health.energy).toBe(3); // avg of 4 and 2
    expect(r.unattributed).toEqual({ minutes: 30, money: 50, votes: 0 });
    expect(r.totals).toEqual({ minutes: 180, money: 200, votes: 3 });
  });

  it("computes honest shares over attributed totals only", () => {
    const r = buildAlignment(
      values,
      [{ valueId: "health", durationMin: 60 }, { valueId: "craft", durationMin: 60 }],
      [],
      [],
      new Map(),
    );
    const health = r.values.find((v) => v.id === "health")!;
    expect(health.timeShare).toBeCloseTo(0.5, 5);
    expect(health.moneyShare).toBe(0); // no money at all
  });

  it("energy is null when the value had no completions", () => {
    const r = buildAlignment(values, [], [], [], new Map([["2026-06-01", 5]]));
    expect(r.values.every((v) => v.energy === null)).toBe(true);
  });

  it("sorts by score descending", () => {
    const r = buildAlignment(
      values,
      [{ valueId: "craft", durationMin: 100 }],
      [],
      [{ valueId: "craft", dateKey: "2026-06-01" }],
      new Map(),
    );
    expect(r.values[0].id).toBe("craft");
  });
});

describe("alignmentScore", () => {
  it("rewards balanced engagement over a single dominant dimension", () => {
    const balanced = alignmentScore({ timeShare: 0.5, voteShare: 0.5, moneyShare: 0.5 });
    const moneyOnly = alignmentScore({ timeShare: 0, voteShare: 0, moneyShare: 1 });
    expect(balanced).toBeGreaterThan(moneyOnly);
  });
  it("weights money at half vs intent dimensions", () => {
    // (0 + 0 + 1*0.5) / 2.5 = 0.2
    expect(alignmentScore({ timeShare: 0, voteShare: 0, moneyShare: 1 })).toBeCloseTo(0.2, 5);
  });
});

describe("topMismatch", () => {
  it("flags a value strong in one dimension but weak in another", () => {
    const r = buildAlignment(
      values,
      [{ valueId: "craft", durationMin: 100 }], // all time to craft
      [{ valueId: "health", amount: 1000 }], // all money to health
      [{ valueId: "craft", dateKey: "2026-06-01" }],
      new Map(),
    );
    const m = topMismatch(r);
    expect(m).not.toBeNull();
    // health has 100% money share, 0% time/votes
    expect(["Health", "Craft"]).toContain(m!.name);
    expect(m!.gap).toBeGreaterThanOrEqual(0.3);
  });
  it("returns null when nothing is lopsided", () => {
    const r = buildAlignment(
      values,
      [{ valueId: "health", durationMin: 50 }, { valueId: "craft", durationMin: 50 }],
      [{ valueId: "health", amount: 50 }, { valueId: "craft", amount: 50 }],
      [{ valueId: "health", dateKey: "2026-06-01" }, { valueId: "craft", dateKey: "2026-06-01" }],
      new Map(),
    );
    expect(topMismatch(r)).toBeNull();
  });
});
