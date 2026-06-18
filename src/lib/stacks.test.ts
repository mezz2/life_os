import { describe, it, expect } from "vitest";
import { orderChain, nextInChain, chainProgress, renumber, reorder } from "./stacks";

const items = [
  { habitId: "c", order: 2 },
  { habitId: "a", order: 0 },
  { habitId: "b", order: 1 },
];

describe("orderChain", () => {
  it("sorts by order ascending", () => {
    expect(orderChain(items).map((x) => x.habitId)).toEqual(["a", "b", "c"]);
  });
  it("is stable for equal orders", () => {
    const eq = [{ habitId: "x", order: 0 }, { habitId: "y", order: 0 }];
    expect(orderChain(eq).map((x) => x.habitId)).toEqual(["x", "y"]);
  });
});

describe("nextInChain", () => {
  it("returns the first not-done item in order", () => {
    expect(nextInChain(items, new Set(["a"]))?.habitId).toBe("b");
  });
  it("returns null when the chain is complete", () => {
    expect(nextInChain(items, new Set(["a", "b", "c"]))).toBeNull();
  });
});

describe("chainProgress", () => {
  it("is the done fraction", () => {
    expect(chainProgress(items, new Set(["a", "b"]))).toBeCloseTo(2 / 3, 5);
  });
  it("is 0 for an empty chain", () => {
    expect(chainProgress([], new Set())).toBe(0);
  });
});

describe("renumber", () => {
  it("assigns contiguous orders", () => {
    expect(renumber(["a", "b", "c"])).toEqual([
      { habitId: "a", order: 0 },
      { habitId: "b", order: 1 },
      { habitId: "c", order: 2 },
    ]);
  });
});

describe("reorder", () => {
  it("moves an item up", () => {
    expect(reorder(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
  });
  it("moves an item down", () => {
    expect(reorder(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
  });
  it("is a no-op at the boundary", () => {
    expect(reorder(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(reorder(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
  });
});
