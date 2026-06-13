// Canonical shape every bank adapter normalises to.
export type CanonicalTxn = {
  date: Date;
  rawDescription: string;
  description: string; // cleaned for display
  amount: number; // signed: negative = out, positive = in (in AUD)
  note?: string; // e.g. original foreign-currency amount for Wise
};

// Rough FX → AUD for foreign accounts (Wise). Editable; good enough for trip tracking.
export const FX_TO_AUD: Record<string, number> = {
  AUD: 1,
  JPY: 0.0099,
  USD: 1.52,
  EUR: 1.63,
  GBP: 1.92,
  NZD: 0.92,
};

export function toAud(amount: number, currency: string): number {
  const rate = FX_TO_AUD[currency?.toUpperCase()] ?? 1;
  return amount * rate;
}

export type BankAdapter = {
  id: string; // cba | westpac | ubank
  label: string;
  // Confidence 0..1 that a parsed CSV (headers + a few rows) belongs to this bank.
  detect: (headers: string[], rows: Record<string, string>[]) => number;
  parse: (rows: Record<string, string>[]) => CanonicalTxn[];
};

// Strip noisy tokens banks append to descriptions.
export function cleanDescription(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/\b(value date|card xx?\d+|receipt \w+|ref:?\s*\w+)\b/gi, "")
    .replace(/\b\d{2}\/\d{2}\/\d{2,4}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseAmount(s: string | undefined): number {
  if (!s) return 0;
  const cleaned = s.replace(/[$,\s]/g, "").replace(/[()]/g, (m) => (m === "(" ? "-" : ""));
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// Parse common AU date formats: dd/mm/yyyy, dd/mm/yy, yyyy-mm-dd.
export function parseDate(s: string | undefined): Date {
  if (!s) return new Date(NaN);
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return new Date(Date.UTC(year, +m[2] - 1, +m[1]));
  }
  const d = new Date(t);
  return isNaN(d.getTime()) ? new Date(NaN) : d;
}
