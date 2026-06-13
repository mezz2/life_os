export function aud(n: number, opts: { cents?: boolean; sign?: boolean } = {}): string {
  const { cents = false, sign = false } = opts;
  const s = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(Math.abs(n));
  if (sign && n !== 0) return `${n > 0 ? "+" : "−"}${s}`;
  return n < 0 ? `−${s}` : s;
}

export function compact(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

export function pct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtDate(d: Date | string, style: "short" | "med" | "month" = "med"): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const fmt: Intl.DateTimeFormatOptions =
    style === "short"
      ? { day: "2-digit", month: "2-digit", year: "2-digit" }
      : style === "month"
        ? { month: "short", year: "numeric" }
        : { day: "numeric", month: "short", year: "numeric" };
  return new Intl.DateTimeFormat("en-AU", { ...fmt, timeZone: "UTC" }).format(date);
}

export function monthKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-AU", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}
