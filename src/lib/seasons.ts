// Seasons & week templates — pure helpers (Phase 9). A Season is a focus window
// [start, end]; a WeekTemplate is a saved set of TimeBlock specs. No DB here;
// everything works on YYYY-MM-DD keys / plain shapes so the page and any future
// insight rule can reuse it. Date math mirrors src/lib/habits.ts key conventions.

const DAY_MS = 86_400_000;

export type SeasonLite = { start: string; end: string };

// Inclusive day count between two date keys (start..end). end before start = 0.
export function daysBetween(startKey: string, endKey: string): number {
  const a = Date.parse(startKey + "T00:00:00.000Z");
  const b = Date.parse(endKey + "T00:00:00.000Z");
  return Math.max(0, Math.round((b - a) / DAY_MS) + 1);
}

// Whole-week length of a season (rounded), min 1.
export function seasonWeeks(s: SeasonLite): number {
  return Math.max(1, Math.round(daysBetween(s.start, s.end) / 7));
}

export function isActiveOn(s: SeasonLite, dateKey: string): boolean {
  return dateKey >= s.start && dateKey <= s.end;
}

// The active season on a date — the one containing it; if several overlap, the
// shortest (most specific) wins, ties broken by latest start.
export function activeSeason<T extends SeasonLite>(seasons: T[], dateKey: string): T | null {
  const live = seasons.filter((s) => isActiveOn(s, dateKey));
  if (live.length === 0) return null;
  return live.sort(
    (a, b) => daysBetween(a.start, a.end) - daysBetween(b.start, b.end) || b.start.localeCompare(a.start),
  )[0];
}

// Fraction of the season elapsed as of `dateKey`, clamped 0..1.
export function seasonProgress(s: SeasonLite, dateKey: string): number {
  const total = daysBetween(s.start, s.end);
  if (total <= 0) return 0;
  const elapsed = daysBetween(s.start, dateKey);
  if (dateKey < s.start) return 0;
  return Math.max(0, Math.min(1, elapsed / total));
}

// Whole weeks left until the season ends (0 once past the end).
export function weeksRemaining(s: SeasonLite, dateKey: string): number {
  if (dateKey > s.end) return 0;
  const from = dateKey < s.start ? s.start : dateKey;
  const days = daysBetween(from, s.end);
  return Math.ceil(days / 7);
}

// ---- goalIds CSV (mirrors the linkedBucket / leadingHabitIds convention) ----

export function parseGoalIds(csv: string | null | undefined): string[] {
  if (!csv) return [];
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function serializeGoalIds(ids: string[]): string | null {
  const clean = [...new Set(ids.map((s) => s.trim()).filter(Boolean))];
  return clean.length ? clean.join(",") : null;
}

// ---- Week-template block specs (a subset of TimeBlock fields) ----

export type BlockSpec = {
  title: string;
  rigidity: string; // flexible | elastic | fluid
  durationMin: number;
  minChunkMin: number;
  energy: string; // high | low | any
  days: string | null; // CSV weekdays 0-6
  startMin: number;
  endMin: number;
  theme: string | null;
  priority: number;
  habitId: string | null;
};

const RIGIDITY = new Set(["flexible", "elastic", "fluid"]);
const ENERGY = new Set(["high", "low", "any"]);

function clampMin(n: unknown, def: number): number {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(0, Math.min(1440, v)) : def;
}

// Coerce an untrusted object into a valid BlockSpec (defensive — templates store
// JSON that may have been hand-edited or written by an older app version).
export function normaliseBlockSpec(raw: Partial<BlockSpec>): BlockSpec {
  return {
    title: String(raw.title ?? "").trim(),
    rigidity: RIGIDITY.has(String(raw.rigidity)) ? String(raw.rigidity) : "flexible",
    durationMin: Math.max(5, Math.round(Number(raw.durationMin) || 30)),
    minChunkMin: Math.max(5, Math.round(Number(raw.minChunkMin) || 30)),
    energy: ENERGY.has(String(raw.energy)) ? String(raw.energy) : "any",
    days: typeof raw.days === "string" && raw.days.trim() ? raw.days.trim() : null,
    startMin: clampMin(raw.startMin, 360),
    endMin: clampMin(raw.endMin, 1320),
    theme: raw.theme ? String(raw.theme).trim() || null : null,
    priority: Number.isFinite(Number(raw.priority)) ? Math.round(Number(raw.priority)) : 100,
    habitId: raw.habitId ? String(raw.habitId) : null,
  };
}

// Parse a stored template blob into clean specs, dropping anything untitled.
export function parseBlocks(blob: string | null | undefined): BlockSpec[] {
  if (!blob) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(blob);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  return arr.map((r) => normaliseBlockSpec(r as Partial<BlockSpec>)).filter((b) => b.title !== "");
}

export function serializeBlocks(specs: BlockSpec[]): string {
  return JSON.stringify(specs.map(normaliseBlockSpec).filter((b) => b.title !== ""));
}

// Total weekly time a template commits, in minutes (a spec on N days counts N×).
export function templateMinutes(specs: BlockSpec[]): number {
  return specs.reduce((sum, b) => {
    const dayCount = b.days ? b.days.split(",").filter(Boolean).length || 1 : 1;
    return sum + b.durationMin * dayCount;
  }, 0);
}
