// Client-safe timeframe model shared by the Budget hub's global control and the
// server queries it drives. No Prisma / db imports here so it can run in the
// browser. A timeframe is expressed as preset + optional custom from/to (YYYY-MM,
// inclusive) and resolves to a continuous list of months plus date bounds.

export type TimeframePreset =
  | "this-month"
  | "last-3mo"
  | "ytd"
  | "last-12mo"
  | "all"
  | "custom";

export type Timeframe = {
  preset: TimeframePreset;
  from?: string; // YYYY-MM, only for "custom"
  to?: string; // YYYY-MM, only for "custom"
};

export type ResolvedRange = {
  months: string[]; // ordered "YYYY-MM", inclusive
  start: Date; // UTC, inclusive
  end: Date; // UTC, exclusive (first day of month after the last)
  label: string;
};

export const PRESET_LABELS: Record<TimeframePreset, string> = {
  "this-month": "This month",
  "last-3mo": "Last 3 months",
  ytd: "Year to date",
  "last-12mo": "Last 12 months",
  all: "All time",
  custom: "Custom",
};

export function monthKeyOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Every "YYYY-MM" from min..max inclusive (continuous, no gaps).
export function monthRange(min: string, max: string): string[] {
  if (min > max) return [];
  const out: string[] = [];
  let [y, m] = min.split("-").map(Number);
  const [ey, em] = max.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

// Shift a "YYYY-MM" key by n months (n may be negative).
export function addMonths(key: string, n: number): string {
  let [y, m] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  y = Math.floor(total / 12);
  m = (total % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function monthStartUTC(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

function monthEndExclusiveUTC(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1));
}

// Resolve a timeframe into concrete months + date bounds. `nowMonth` and
// `earliestMonth` let callers pin "today" and the start of available data
// (needed for the "all" / "ytd" presets) deterministically.
export function resolveTimeframe(
  tf: Timeframe,
  opts: { nowMonth: string; earliestMonth?: string },
): ResolvedRange {
  const now = opts.nowMonth;
  const earliest = opts.earliestMonth ?? now;
  let from = now;
  let to = now;

  switch (tf.preset) {
    case "this-month":
      from = to = now;
      break;
    case "last-3mo":
      from = addMonths(now, -2);
      to = now;
      break;
    case "last-12mo":
      from = addMonths(now, -11);
      to = now;
      break;
    case "ytd":
      from = `${now.slice(0, 4)}-01`;
      to = now;
      break;
    case "all":
      from = earliest;
      to = now > earliest ? now : earliest;
      break;
    case "custom": {
      const a = tf.from ?? now;
      const b = tf.to ?? now;
      from = a <= b ? a : b;
      to = a <= b ? b : a;
      break;
    }
  }

  const months = monthRange(from, to);
  const label =
    tf.preset === "custom"
      ? months.length === 1
        ? from
        : `${from} → ${to}`
      : PRESET_LABELS[tf.preset];

  return {
    months,
    start: monthStartUTC(from),
    end: monthEndExclusiveUTC(to),
    label,
  };
}

// Serialise a timeframe to URL search params and back, so the server component
// can read it from the request and the client control can drive it via the URL.
export function timeframeToParams(tf: Timeframe): Record<string, string> {
  if (tf.preset === "custom" && tf.from && tf.to) {
    return { tf: "custom", from: tf.from, to: tf.to };
  }
  return { tf: tf.preset };
}

export function timeframeFromParams(params: {
  tf?: string;
  from?: string;
  to?: string;
}): Timeframe {
  const preset = (params.tf as TimeframePreset) || "last-3mo";
  const valid: TimeframePreset[] = [
    "this-month",
    "last-3mo",
    "ytd",
    "last-12mo",
    "all",
    "custom",
  ];
  if (!valid.includes(preset)) return { preset: "last-3mo" };
  if (preset === "custom") {
    return { preset: "custom", from: params.from, to: params.to };
  }
  return { preset };
}
