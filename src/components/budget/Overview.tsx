import { aud, pct } from "@/lib/format";

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  const c =
    tone === "positive"
      ? "var(--color-positive)"
      : tone === "negative"
        ? "var(--color-negative)"
        : "var(--color-text)";
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: "var(--color-surface-2)" }}>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
        {label}
      </div>
      <div className="num text-lg font-semibold mt-0.5" style={{ color: c }}>
        {value}
      </div>
    </div>
  );
}

// Headline numbers for the selected period.
export function KpiStrip({
  incomeTotal,
  expenseTotal,
}: {
  incomeTotal: number;
  expenseTotal: number;
}) {
  const net = incomeTotal - expenseTotal;
  const rate = incomeTotal > 0 ? net / incomeTotal : 0;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <MiniStat label="Income" value={aud(incomeTotal)} tone="positive" />
      <MiniStat label="Spend" value={aud(expenseTotal)} />
      <MiniStat label="Net" value={aud(net, { sign: true })} tone={net >= 0 ? "positive" : "negative"} />
      <MiniStat label="Savings rate" value={pct(rate, 0)} tone={rate >= 0 ? "positive" : "negative"} />
    </div>
  );
}
