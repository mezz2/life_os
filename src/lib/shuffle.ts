// Shuffle engine — the pure constraint solver. Reflows flexible/elastic/fluid
// time blocks around fixed commitments (busy intervals from the calendar),
// respecting day/time windows, energy profile, minimum chunk sizes, and — above
// all — guaranteeing habit-linked blocks get placed first. No DB, no Claude, no
// dates beyond YYYY-MM-DD day keys + minutes-from-midnight. Fully unit-testable.

import { addDaysKey, startOfWeekKey } from "./habits";

export type Rigidity = "fixed" | "flexible" | "elastic" | "fluid";
export type Energy = "high" | "low" | "any";

export type Block = {
  id: string;
  title: string;
  rigidity: Rigidity; // fixed blocks are treated as already-busy, not placed
  durationMin: number;
  minChunkMin: number; // elastic: smallest contiguous piece; others: ignored
  energy: Energy;
  days: number[]; // allowed weekdays 0=Sun..6=Sat ([] = any day)
  startMin: number; // earliest time-of-day (minutes from midnight)
  endMin: number; // latest time-of-day
  habitId: string | null; // habit blocks are protected (placed first)
  priority: number; // tie-breaker within a tier (lower = sooner)
};

// A fixed commitment on a given day, in minutes-from-midnight.
export type Busy = { dayKey: string; startMin: number; endMin: number };

export type Placement = { blockId: string; title: string; dayKey: string; startMin: number; endMin: number };
export type Unplaced = { blockId: string; title: string; remainingMin: number; reason: string };
export type Proposal = { placements: Placement[]; unplaced: Unplaced[] };

export type SolveOpts = {
  weekStartKey: string; // Monday of the target week
  dayStartMin?: number; // earliest usable time each day (default 06:00)
  dayEndMin?: number; // latest usable time each day (default 22:00)
};

type Interval = { startMin: number; endMin: number };

// Free intervals in [dayStart, dayEnd] after removing (merged) busy intervals.
export function freeSlots(dayStart: number, dayEnd: number, busy: Interval[]): Interval[] {
  const merged = mergeIntervals(busy.filter((b) => b.endMin > dayStart && b.startMin < dayEnd));
  const free: Interval[] = [];
  let cursor = dayStart;
  for (const b of merged) {
    const s = Math.max(b.startMin, dayStart);
    const e = Math.min(b.endMin, dayEnd);
    if (s > cursor) free.push({ startMin: cursor, endMin: s });
    cursor = Math.max(cursor, e);
  }
  if (cursor < dayEnd) free.push({ startMin: cursor, endMin: dayEnd });
  return free;
}

function mergeIntervals(xs: Interval[]): Interval[] {
  const sorted = [...xs].sort((a, b) => a.startMin - b.startMin);
  const out: Interval[] = [];
  for (const x of sorted) {
    const last = out[out.length - 1];
    if (last && x.startMin <= last.endMin) last.endMin = Math.max(last.endMin, x.endMin);
    else out.push({ ...x });
  }
  return out;
}

// Ordering tiers: habit blocks first (protected), then flexible, elastic, fluid.
function tier(b: Block): number {
  if (b.habitId) return 0;
  return { flexible: 1, elastic: 2, fluid: 3, fixed: 9 }[b.rigidity];
}

function dayKeysFor(block: Block, weekStartKey: string): string[] {
  const all = Array.from({ length: 7 }, (_, i) => ({ key: addDaysKey(weekStartKey, i), dow: dowOf(addDaysKey(weekStartKey, i)) }));
  const allowed = block.days.length ? all.filter((d) => block.days.includes(d.dow)) : all;
  return allowed.map((d) => d.key);
}

function dowOf(key: string): number {
  return new Date(key + "T00:00:00.000Z").getUTCDay();
}

// "high" energy prefers earlier slots, "low" prefers later; "any" earliest-first.
function orderSlots(slots: Interval[], energy: Energy): Interval[] {
  const s = [...slots];
  if (energy === "low") s.sort((a, b) => b.startMin - a.startMin);
  else s.sort((a, b) => a.startMin - b.startMin);
  return s;
}

// Clamp a block's time-of-day window onto a free interval, returning the usable
// sub-interval (or null if the window doesn't intersect or is too small).
function windowed(slot: Interval, block: Block): Interval | null {
  const s = Math.max(slot.startMin, block.startMin);
  const e = Math.min(slot.endMin, block.endMin);
  return e > s ? { startMin: s, endMin: e } : null;
}

export function proposeSchedule(blocks: Block[], busy: Busy[], opts: SolveOpts): Proposal {
  const dayStart = opts.dayStartMin ?? 360;
  const dayEnd = opts.dayEndMin ?? 1320;

  // Mutable free-slot map per day, seeded from busy.
  const byDay = new Map<string, Interval[]>();
  const dayKeys = Array.from({ length: 7 }, (_, i) => addDaysKey(opts.weekStartKey, i));
  for (const dk of dayKeys) {
    const dayBusy = busy.filter((b) => b.dayKey === dk);
    byDay.set(dk, freeSlots(dayStart, dayEnd, dayBusy));
  }

  const placements: Placement[] = [];
  const unplaced: Unplaced[] = [];
  const ordered = [...blocks]
    .filter((b) => b.rigidity !== "fixed")
    .sort((a, b) => tier(a) - tier(b) || a.priority - b.priority);

  for (const block of ordered) {
    const candidateDays = dayKeysFor(block, opts.weekStartKey);
    let remaining = block.durationMin;
    const isElastic = block.rigidity === "elastic";
    const minPiece = isElastic ? Math.max(1, block.minChunkMin) : block.durationMin;

    // Build the candidate (day, slot) list. For non-elastic we want a single
    // slot fitting the whole duration; for elastic we accumulate pieces.
    for (const dk of candidateDays) {
      if (remaining <= 0) break;
      const slots = orderSlots(byDay.get(dk) ?? [], block.energy);
      for (let i = 0; i < slots.length && remaining > 0; i++) {
        const w = windowed(slots[i], block);
        if (!w) continue;
        const avail = w.endMin - w.startMin;
        if (!isElastic) {
          if (avail < remaining) continue; // need the whole block in one piece
          // Low-energy blocks settle at the end of the slot (later in the day).
          const s = block.energy === "low" ? w.endMin - remaining : w.startMin;
          place(block, dk, s, s + remaining, placements, byDay);
          remaining = 0;
          break;
        } else {
          if (avail < minPiece) continue;
          const piece = Math.min(avail, remaining);
          const s = block.energy === "low" ? w.endMin - piece : w.startMin;
          place(block, dk, s, s + piece, placements, byDay);
          remaining -= piece;
        }
      }
    }

    if (remaining > 0) {
      const reason =
        block.rigidity === "fluid"
          ? "dropped — no room under this week's load"
          : block.rigidity === "elastic"
            ? "partially placed — not enough free time"
            : "no single free slot fits this block";
      unplaced.push({ blockId: block.id, title: block.title, remainingMin: remaining, reason });
    }
  }

  placements.sort((a, b) => a.dayKey.localeCompare(b.dayKey) || a.startMin - b.startMin);
  return { placements, unplaced };
}

// Place a piece and carve it out of the day's free slots.
function place(
  block: Block,
  dk: string,
  startMin: number,
  endMin: number,
  placements: Placement[],
  byDay: Map<string, Interval[]>,
) {
  placements.push({ blockId: block.id, title: block.title, dayKey: dk, startMin, endMin });
  const slots = byDay.get(dk) ?? [];
  const next: Interval[] = [];
  for (const s of slots) {
    if (endMin <= s.startMin || startMin >= s.endMin) {
      next.push(s);
      continue;
    }
    if (startMin > s.startMin) next.push({ startMin: s.startMin, endMin: startMin });
    if (endMin < s.endMin) next.push({ startMin: endMin, endMin: s.endMin });
  }
  byDay.set(dk, next);
}

// Diff two proposals (e.g. last-applied vs new) for the approval view.
export type Diff = {
  added: Placement[];
  removed: Placement[];
  moved: { blockId: string; title: string; from: Placement; to: Placement }[];
};

export function diffProposals(prev: Placement[], next: Placement[]): Diff {
  const keyOf = (p: Placement) => p.blockId;
  const prevByBlock = new Map(prev.map((p) => [keyOf(p), p]));
  const nextByBlock = new Map(next.map((p) => [keyOf(p), p]));
  const added: Placement[] = [];
  const removed: Placement[] = [];
  const moved: Diff["moved"] = [];
  for (const [id, p] of nextByBlock) {
    const old = prevByBlock.get(id);
    if (!old) added.push(p);
    else if (old.dayKey !== p.dayKey || old.startMin !== p.startMin) {
      moved.push({ blockId: id, title: p.title, from: old, to: p });
    }
  }
  for (const [id, p] of prevByBlock) {
    if (!nextByBlock.has(id)) removed.push(p);
  }
  return { added, removed, moved };
}

// Convenience: the Monday key for any day (re-exported for callers/tests).
export function weekStartOf(dayKey: string): string {
  return startOfWeekKey(dayKey);
}

// A structured weekly demand — what Claude parses free-text into ("crazy work
// week, protect Sunday, drop the nice-to-haves"). Kept separate + pure so the
// interpretation is deterministic and unit-testable; Claude only fills this in.
export type Demand = {
  protectedDays?: number[]; // weekdays 0-6 to keep entirely free
  dropFluid?: boolean; // demote all fluid blocks this week
  extraBusy?: { dow: number; startMin: number; endMin: number }[]; // heavier days
};

// Apply a parsed demand to the solve inputs, returning adjusted blocks + busy.
export function applyDemand(
  blocks: Block[],
  busy: Busy[],
  demand: Demand,
  weekStartKey: string,
): { blocks: Block[]; busy: Busy[] } {
  let outBlocks = blocks;
  const outBusy = [...busy];
  const dayKeyForDow = (dow: number): string | null => {
    for (let i = 0; i < 7; i++) {
      const k = addDaysKey(weekStartKey, i);
      if (dowOf(k) === dow) return k;
    }
    return null;
  };

  if (demand.dropFluid) outBlocks = outBlocks.filter((b) => b.rigidity !== "fluid");

  for (const dow of demand.protectedDays ?? []) {
    const k = dayKeyForDow(dow);
    if (k) outBusy.push({ dayKey: k, startMin: 0, endMin: 1440 });
  }
  for (const eb of demand.extraBusy ?? []) {
    const k = dayKeyForDow(eb.dow);
    if (k) outBusy.push({ dayKey: k, startMin: eb.startMin, endMin: eb.endMin });
  }
  return { blocks: outBlocks, busy: outBusy };
}
