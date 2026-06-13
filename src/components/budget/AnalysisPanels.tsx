"use client";

import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ArrowLeft, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { CATEGORY_COLORS } from "@/lib/constants";
import { aud, pct, compact } from "@/lib/format";
import { useChartInk } from "@/components/Theme";
import type { CatSeries, MerchantSpend, LargeTxn } from "@/lib/queries";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortMonth = (key: string) => {
  const [y, m] = key.split("-");
  return `${MON[Number(m) - 1]} ’${y.slice(2)}`;
};
const color = (i: number) => CATEGORY_COLORS[i % CATEGORY_COLORS.length];

// ---------------------------------------------------------------- % of spend
export function PercentBreakdown({
  categories,
  expenseTotal,
}: {
  categories: CatSeries[];
  expenseTotal: number;
}) {
  const [drill, setDrill] = useState<string | null>(null);
  const ink = useChartInk();

  if (expenseTotal <= 0) {
    return <Empty>No spending in this period.</Empty>;
  }

  const drilled = drill ? categories.find((c) => c.id === drill) : null;
  const items = (drilled ? drilled.subs : categories)
    .filter((x) => x.total > 0)
    .map((x) => ({ id: x.id, name: x.name, total: x.total }));
  const setTotal = items.reduce((s, x) => s + x.total, 0);
  const max = Math.max(...items.map((x) => x.total), 1);

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="relative">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={items} dataKey="total" nameKey="name" cx="50%" cy="50%" innerRadius={62} outerRadius={92} paddingAngle={1} strokeWidth={0}>
              {items.map((x, i) => (
                <Cell key={x.id} fill={color(i)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: ink.panel, border: `1px solid ${ink.border}`, borderRadius: 10, fontSize: 12 }}
              formatter={(v, n) => [`${aud(Number(v))} · ${pct(Number(v) / setTotal, 0)}`, String(n)]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-xs" style={{ color: "var(--color-muted)" }}>
            {drilled ? drilled.name : "Total spend"}
          </div>
          <div className="num text-lg font-semibold">{aud(setTotal)}</div>
        </div>
      </div>

      <div>
        {drilled && (
          <button
            onClick={() => setDrill(null)}
            className="flex items-center gap-1 text-xs mb-2"
            style={{ color: "var(--color-accent)" }}
          >
            <ArrowLeft size={13} /> All categories
          </button>
        )}
        <div className="space-y-2">
          {items.map((x, i) => {
            const canDrill = !drilled && (categories.find((c) => c.id === x.id)?.subs.length ?? 0) > 0;
            return (
              <button
                key={x.id}
                onClick={() => canDrill && setDrill(x.id)}
                className="w-full text-left"
                style={{ cursor: canDrill ? "pointer" : "default" }}
              >
                <div className="flex items-center justify-between gap-3 text-xs mb-1">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color(i) }} />
                    <span className="truncate">{x.name}</span>
                  </span>
                  <span className="num shrink-0" style={{ color: "var(--color-muted)" }}>
                    {aud(x.total)} <span className="opacity-60">· {pct(x.total / setTotal, 0)}</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
                  <div className="h-full rounded-full" style={{ width: `${(x.total / max) * 100}%`, background: color(i) }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------ savings rate & cashflow
export function CashflowPanel({
  months,
  incomeMonthly,
  expenseMonthly,
  netMonthly,
}: {
  months: string[];
  incomeMonthly: number[];
  expenseMonthly: number[];
  netMonthly: number[];
}) {
  const ink = useChartInk();
  if (months.length === 0) return <Empty>No data in this period.</Empty>;

  const data = months.map((m, i) => ({
    month: m,
    income: incomeMonthly[i],
    expense: expenseMonthly[i],
    net: netMonthly[i],
    rate: incomeMonthly[i] > 0 ? (netMonthly[i] / incomeMonthly[i]) * 100 : 0,
  }));
  const totIncome = incomeMonthly.reduce((a, b) => a + b, 0);
  const totNet = netMonthly.reduce((a, b) => a + b, 0);
  const overallRate = totIncome > 0 ? totNet / totIncome : 0;
  const axisTick = { fill: ink.axis, fontSize: 11 };

  return (
    <div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 mb-3 text-xs">
        <Metric label="Income" value={aud(totIncome)} />
        <Metric label="Net saved" value={aud(totNet)} tone={totNet >= 0 ? "positive" : "negative"} />
        <Metric label="Savings rate" value={pct(overallRate, 0)} tone={overallRate >= 0 ? "positive" : "negative"} />
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={ink.grid} vertical={false} />
          <XAxis dataKey="month" tickFormatter={shortMonth} tick={axisTick} minTickGap={20} />
          <YAxis tickFormatter={compact} tick={axisTick} width={46} />
          <YAxis yAxisId="rate" orientation="right" tickFormatter={(v) => `${Math.round(v)}%`} tick={axisTick} width={40} domain={[-20, 100]} />
          <Tooltip
            contentStyle={{ background: ink.panel, border: `1px solid ${ink.border}`, borderRadius: 10, fontSize: 12 }}
            labelFormatter={(l) => shortMonth(String(l))}
            formatter={(v, n) => (String(n) === "Savings rate" ? [`${Math.round(Number(v))}%`, String(n)] : [aud(Number(v)), String(n)])}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
          <Bar dataKey="income" name="Income" fill="#34d399" fillOpacity={0.85} radius={[3, 3, 0, 0]} />
          <Bar dataKey="expense" name="Expense" fill="#f87171" fillOpacity={0.85} radius={[3, 3, 0, 0]} />
          <Line dataKey="net" name="Net" type="monotone" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
          <Line yAxisId="rate" dataKey="rate" name="Savings rate" type="monotone" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ----------------------------------------------------------- spend trend over time
export function SpendTrend({ months, categories }: { months: string[]; categories: CatSeries[] }) {
  const [mode, setMode] = useState<"area" | "bar">("area");
  const ink = useChartInk();
  if (months.length === 0 || categories.length === 0) return <Empty>No spending in this period.</Empty>;

  const series = categories.filter((c) => c.total > 0);
  const data = months.map((m, i) => {
    const row: Record<string, number | string> = { month: m };
    for (const c of series) row[c.name] = c.monthly[i];
    return row;
  });
  const axisTick = { fill: ink.axis, fontSize: 11 };
  const tooltip = (
    <Tooltip
      contentStyle={{ background: ink.panel, border: `1px solid ${ink.border}`, borderRadius: 10, fontSize: 12 }}
      labelFormatter={(l) => shortMonth(String(l))}
      formatter={(v, n) => [aud(Number(v)), String(n)]}
    />
  );
  const grid = <CartesianGrid strokeDasharray="3 3" stroke={ink.grid} vertical={false} />;
  const legend = <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />;

  return (
    <div>
      <div className="flex justify-end mb-3">
        <SmallToggle value={mode} onChange={setMode} options={[["area", "Stacked"], ["bar", "Bars"]]} />
      </div>
      <ResponsiveContainer width="100%" height={320}>
        {mode === "area" ? (
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {grid}
            <XAxis dataKey="month" tickFormatter={shortMonth} tick={axisTick} minTickGap={20} />
            <YAxis tickFormatter={compact} tick={axisTick} width={46} />
            {tooltip}
            {legend}
            {series.map((c, i) => (
              <Area key={c.id} dataKey={c.name} name={c.name} stackId="s" type="monotone" stroke={color(i)} fill={color(i)} fillOpacity={0.55} strokeWidth={1} />
            ))}
          </AreaChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {grid}
            <XAxis dataKey="month" tickFormatter={shortMonth} tick={axisTick} minTickGap={20} />
            <YAxis tickFormatter={compact} tick={axisTick} width={46} />
            {tooltip}
            {legend}
            {series.map((c, i) => (
              <Bar key={c.id} dataKey={c.name} name={c.name} stackId="s" fill={color(i)} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// ----------------------------------------------------------- top movers & merchants
export function TopMovers({
  months,
  categories,
  topMerchants,
  largestTxns,
}: {
  months: string[];
  categories: CatSeries[];
  topMerchants: MerchantSpend[];
  largestTxns: LargeTxn[];
}) {
  // Movers across the selected timeframe: first month in range vs last,
  // biggest abs change. Spanning the whole range keeps this in step with the
  // global filter (rather than always comparing the final two months).
  const movers =
    months.length >= 2
      ? categories
          .map((c) => {
            const last = c.monthly[c.monthly.length - 1];
            const prev = c.monthly[0];
            return { name: c.name, last, prev, delta: last - prev, momPct: prev > 0 ? (last - prev) / prev : null };
          })
          .filter((m) => Math.abs(m.delta) > 0)
          .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
          .slice(0, 6)
      : [];

  return (
    <div className="space-y-5">
      <div>
        <Heading>
          Movers <span style={{ color: "var(--color-muted)" }}>· {months.length >= 2 ? `${shortMonth(months[0])} → ${shortMonth(months[months.length - 1])}` : "—"}</span>
        </Heading>
        {movers.length === 0 ? (
          <Muted>Need at least two months in range.</Muted>
        ) : (
          <div className="space-y-2">
            {movers.map((m) => {
              const up = m.delta > 0;
              return (
                <div key={m.name} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate">{m.name}</span>
                  <span className="num flex items-center gap-1 shrink-0" style={{ color: up ? "var(--color-negative)" : "var(--color-positive)" }}>
                    {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                    {aud(m.delta, { sign: true })}
                    {m.momPct !== null && <span className="opacity-60">({pct(Math.abs(m.momPct), 0)})</span>}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <Heading>Top merchants</Heading>
        {topMerchants.length === 0 ? (
          <Muted>No merchant spend.</Muted>
        ) : (
          <div className="space-y-2">
            {topMerchants.slice(0, 8).map((m) => (
              <div key={m.description} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate" title={m.description}>
                  {m.description}
                  <span className="ml-1.5 opacity-50">×{m.count}</span>
                </span>
                <span className="num shrink-0" style={{ color: "var(--color-muted)" }}>
                  {aud(m.total)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <Heading>Largest transactions</Heading>
        {largestTxns.length === 0 ? (
          <Muted>No transactions.</Muted>
        ) : (
          <div className="space-y-2">
            {largestTxns.slice(0, 8).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate" title={t.description}>
                  {t.description}
                  {t.category && <span className="ml-1.5 opacity-50">{t.category}</span>}
                </span>
                <span className="num shrink-0" style={{ color: "var(--color-muted)" }}>
                  {aud(Math.abs(t.amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- helpers
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-8 text-center text-sm" style={{ color: "var(--color-muted)" }}>
      {children}
    </div>
  );
}
function Muted({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs py-2" style={{ color: "var(--color-muted)" }}>
      {children}
    </div>
  );
}
function Heading({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold uppercase tracking-wide mb-2.5" style={{ color: "var(--color-muted)" }}>{children}</div>;
}
function Metric({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  const c = tone === "positive" ? "var(--color-positive)" : tone === "negative" ? "var(--color-negative)" : "var(--color-text)";
  return (
    <span>
      <span style={{ color: "var(--color-muted)" }}>{label} </span>
      <span className="num font-semibold" style={{ color: c }}>{value}</span>
    </span>
  );
}
function SmallToggle<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="inline-flex rounded-lg p-0.5 gap-0.5" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
          style={{ background: value === v ? "var(--color-accent)" : "transparent", color: value === v ? "var(--color-bg)" : "var(--color-muted)" }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
