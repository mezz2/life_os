import { describe, it, expect } from "vitest";
import {
  freeSlots,
  proposeSchedule,
  diffProposals,
  applyDemand,
  type Block,
  type Busy,
  type Placement,
} from "./shuffle";

// Week of Mon 2026-06-08 .. Sun 2026-06-14 (UTC). 2026-06-08 is a Monday.
const MON = "2026-06-08";
const TUE = "2026-06-09";

function block(over: Partial<Block> & { id: string }): Block {
  return {
    title: over.id,
    rigidity: "flexible",
    durationMin: 60,
    minChunkMin: 30,
    energy: "any",
    days: [],
    startMin: 0,
    endMin: 1440,
    habitId: null,
    priority: 100,
    ...over,
  };
}

describe("freeSlots", () => {
  it("returns the whole day when nothing is busy", () => {
    expect(freeSlots(360, 1320, [])).toEqual([{ startMin: 360, endMin: 1320 }]);
  });
  it("carves out a busy block in the middle", () => {
    expect(freeSlots(360, 1320, [{ startMin: 540, endMin: 600 }])).toEqual([
      { startMin: 360, endMin: 540 },
      { startMin: 600, endMin: 1320 },
    ]);
  });
  it("merges overlapping busy intervals", () => {
    const busy = [
      { startMin: 540, endMin: 600 },
      { startMin: 570, endMin: 660 },
    ];
    expect(freeSlots(360, 1320, busy)).toEqual([
      { startMin: 360, endMin: 540 },
      { startMin: 660, endMin: 1320 },
    ]);
  });
  it("clips busy that extends beyond the day bounds", () => {
    expect(freeSlots(360, 1320, [{ startMin: 300, endMin: 420 }])).toEqual([{ startMin: 420, endMin: 1320 }]);
  });
});

describe("proposeSchedule — basic placement", () => {
  it("places a flexible block in the first free slot", () => {
    const p = proposeSchedule([block({ id: "read", durationMin: 30 })], [], { weekStartKey: MON });
    expect(p.unplaced).toHaveLength(0);
    expect(p.placements[0]).toMatchObject({ blockId: "read", dayKey: MON, startMin: 360, endMin: 390 });
  });

  it("places around a fixed busy commitment", () => {
    const busy: Busy[] = [{ dayKey: MON, startMin: 360, endMin: 540 }]; // 6–9am busy
    const p = proposeSchedule([block({ id: "deep", durationMin: 60, days: [1] })], busy, { weekStartKey: MON });
    expect(p.placements[0]).toMatchObject({ dayKey: MON, startMin: 540, endMin: 600 });
  });

  it("respects the allowed-days window", () => {
    // only Tuesday (dow 2) allowed
    const p = proposeSchedule([block({ id: "lang", durationMin: 60, days: [2] })], [], { weekStartKey: MON });
    expect(p.placements[0].dayKey).toBe(TUE);
  });

  it("respects the time-of-day window", () => {
    const p = proposeSchedule(
      [block({ id: "evening", durationMin: 60, startMin: 1080, endMin: 1320 })], // 6pm–10pm only
      [],
      { weekStartKey: MON },
    );
    expect(p.placements[0].startMin).toBe(1080);
  });
});

describe("proposeSchedule — energy preference", () => {
  it("high-energy blocks land earlier, low-energy later", () => {
    const high = proposeSchedule([block({ id: "h", durationMin: 60, energy: "high", days: [1] })], [], { weekStartKey: MON });
    const low = proposeSchedule([block({ id: "l", durationMin: 60, energy: "low", days: [1] })], [], { weekStartKey: MON });
    expect(high.placements[0].startMin).toBe(360); // day start
    expect(low.placements[0].endMin).toBe(1320); // day end
  });
});

describe("proposeSchedule — habit protection", () => {
  it("places the habit block before a competing flexible block in a tight day", () => {
    // Only 60 min free on Monday; a habit block and a flexible block both want it.
    const busy: Busy[] = [{ dayKey: MON, startMin: 420, endMin: 1320 }]; // only 360–420 free (60m)
    const blocks = [
      block({ id: "flex", durationMin: 60, days: [1], priority: 1 }),
      block({ id: "habit", durationMin: 60, days: [1], habitId: "h1", priority: 999 }),
    ];
    const p = proposeSchedule(blocks, busy, { weekStartKey: MON });
    const placed = p.placements.map((x) => x.blockId);
    expect(placed).toContain("habit");
    expect(p.unplaced.map((u) => u.blockId)).toContain("flex");
  });
});

describe("proposeSchedule — elastic splitting", () => {
  it("splits an elastic block across days into chunks", () => {
    // 3h elastic, min 60m chunks, but each day only has 60m free.
    const busy: Busy[] = [MON, TUE, "2026-06-10"].map((d) => ({ dayKey: d, startMin: 420, endMin: 1320 }));
    const p = proposeSchedule(
      [block({ id: "study", rigidity: "elastic", durationMin: 180, minChunkMin: 60, days: [1, 2, 3] })],
      busy,
      { weekStartKey: MON },
    );
    const total = p.placements.filter((x) => x.blockId === "study").reduce((t, x) => t + (x.endMin - x.startMin), 0);
    expect(total).toBe(180);
    expect(p.placements.filter((x) => x.blockId === "study").length).toBeGreaterThanOrEqual(3);
  });

  it("reports remaining minutes when an elastic block cannot fully fit", () => {
    // 120m elastic but only one 60m slot all week (Monday only allowed).
    const busy: Busy[] = [{ dayKey: MON, startMin: 420, endMin: 1320 }];
    const p = proposeSchedule(
      [block({ id: "study", rigidity: "elastic", durationMin: 120, minChunkMin: 60, days: [1] })],
      busy,
      { weekStartKey: MON },
    );
    expect(p.unplaced).toHaveLength(1);
    expect(p.unplaced[0]).toMatchObject({ blockId: "study", remainingMin: 60 });
  });
});

describe("proposeSchedule — fluid drops under load", () => {
  it("drops a fluid block when there is no room", () => {
    const busy: Busy[] = Array.from({ length: 7 }, (_, i) => ({
      dayKey: `2026-06-0${8 + i}`.replace("2026-06-0", (n) => n).slice(0, 10),
      startMin: 360,
      endMin: 1320,
    }));
    // simpler: fully block Monday-only fluid
    const fluid = block({ id: "nice", rigidity: "fluid", durationMin: 60, days: [1] });
    const p = proposeSchedule([fluid], [{ dayKey: MON, startMin: 360, endMin: 1320 }], { weekStartKey: MON });
    expect(p.placements).toHaveLength(0);
    expect(p.unplaced[0].reason).toMatch(/dropped/);
    void busy;
  });
});

describe("applyDemand", () => {
  const blocks = [
    block({ id: "deep", rigidity: "elastic" }),
    block({ id: "nice", rigidity: "fluid" }),
  ];
  it("drops fluid blocks when demanded", () => {
    const { blocks: out } = applyDemand(blocks, [], { dropFluid: true }, MON);
    expect(out.map((b) => b.id)).toEqual(["deep"]);
  });
  it("adds full-day busy for protected weekdays", () => {
    // protect Sunday (dow 0) -> that week's Sunday is 2026-06-14
    const { busy } = applyDemand(blocks, [], { protectedDays: [0] }, MON);
    expect(busy).toContainEqual({ dayKey: "2026-06-14", startMin: 0, endMin: 1440 });
  });
  it("injects extra busy on heavier days", () => {
    const { busy } = applyDemand(blocks, [], { extraBusy: [{ dow: 1, startMin: 540, endMin: 1080 }] }, MON);
    expect(busy).toContainEqual({ dayKey: MON, startMin: 540, endMin: 1080 });
  });
  it("makes a protected day actually block placement end-to-end", () => {
    // A Sunday-only flexible block becomes unplaceable once Sunday is protected.
    const sundayBlock = block({ id: "sun", days: [0], durationMin: 60 });
    const { blocks: b2, busy } = applyDemand([sundayBlock], [], { protectedDays: [0] }, MON);
    const p = proposeSchedule(b2, busy, { weekStartKey: MON });
    expect(p.placements).toHaveLength(0);
    expect(p.unplaced.map((u) => u.blockId)).toContain("sun");
  });
});

describe("diffProposals", () => {
  const a: Placement = { blockId: "gym", title: "Gym", dayKey: MON, startMin: 360, endMin: 420 };
  const aMoved: Placement = { blockId: "gym", title: "Gym", dayKey: TUE, startMin: 360, endMin: 420 };
  const b: Placement = { blockId: "read", title: "Read", dayKey: MON, startMin: 600, endMin: 630 };

  it("detects moved, added and removed placements", () => {
    const d = diffProposals([a, b], [aMoved]);
    expect(d.moved).toHaveLength(1);
    expect(d.moved[0]).toMatchObject({ blockId: "gym" });
    expect(d.removed.map((p) => p.blockId)).toEqual(["read"]);
    expect(d.added).toHaveLength(0);
  });
  it("reports a brand-new placement as added", () => {
    const d = diffProposals([], [a]);
    expect(d.added).toHaveLength(1);
    expect(d.moved).toHaveLength(0);
  });
});
