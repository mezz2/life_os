// Habit stacking — pure helpers. A stack is an ordered chain of habits anchored
// to a cue ("After I [cue], I will…"). No DB; works on plain shapes.

export type ChainItem = { habitId: string; order: number };

// Stable ascending order by `order`, tie-broken by original index.
export function orderChain<T extends ChainItem>(items: T[]): T[] {
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => a.it.order - b.it.order || a.i - b.i)
    .map((x) => x.it);
}

// The next habit to do in the chain: the first ordered item not in `done`.
export function nextInChain<T extends ChainItem>(items: T[], done: Set<string>): T | null {
  for (const it of orderChain(items)) {
    if (!done.has(it.habitId)) return it;
  }
  return null;
}

// Fraction of the chain completed today (0..1).
export function chainProgress(items: ChainItem[], done: Set<string>): number {
  if (items.length === 0) return 0;
  const hit = items.filter((it) => done.has(it.habitId)).length;
  return hit / items.length;
}

// Reassign contiguous order values from an ordered list of habit ids — used when
// the user reorders or removes an item so `order` stays 0..n-1.
export function renumber(habitIds: string[]): ChainItem[] {
  return habitIds.map((habitId, i) => ({ habitId, order: i }));
}

// Move an item up/down within the chain, returning the new id order.
export function reorder(habitIds: string[], habitId: string, dir: -1 | 1): string[] {
  const i = habitIds.indexOf(habitId);
  if (i < 0) return habitIds;
  const j = i + dir;
  if (j < 0 || j >= habitIds.length) return habitIds;
  const next = [...habitIds];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
