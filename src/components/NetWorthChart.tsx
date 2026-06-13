"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { BUCKET_COLORS, CATEGORY_COLORS } from "@/lib/constants";
import { aud, compact, fmtDate } from "@/lib/format";
import { useChartInk } from "@/components/Theme";

type Point = { date: string; total: number; [bucket: string]: number | string };
type Mode = "stacked" | "lines";
type Ink = ReturnType<typeof useChartInk>;

const colorFor = (bucket: string, i: number) => BUCKET_COLORS[bucket] ?? CATEGORY_COLORS[i % CATEGORY_COLORS.length];

type TooltipEntry = { name?: string; value?: number; color?: string };

function NetWorthTooltip({
  active,
  label,
  payload,
  ink,
}: {
  active?: boolean;
  label?: string;
  payload?: TooltipEntry[];
  ink?: Ink;
}) {
  if (!active || !payload || payload.length === 0 || !ink) return null;
  const total = payload.reduce((s, e) => s + (Number(e.value) || 0), 0);
  // Largest bucket first for readability.
  const rows = [...payload].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  return (
    <div
      className="text-xs"
      style={{ background: ink.panel, border: `1px solid ${ink.border}`, borderRadius: 12, padding: "10px 12px", minWidth: 180 }}
    >
      <div className="mb-1.5" style={{ color: ink.axis }}>
        {fmtDate(label as string)}
      </div>
      <div className="flex items-center justify-between gap-6 pb-2 mb-2" style={{ borderBottom: `1px solid ${ink.border}` }}>
        <span className="font-medium" style={{ color: ink.text }}>
          Total
        </span>
        <span className="num font-semibold" style={{ color: ink.text }}>
          {aud(total)}
        </span>
      </div>
      <div className="space-y-1">
        {rows.map((e) => (
          <div key={e.name} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5" style={{ color: ink.axis }}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: e.color }} />
              {e.name}
            </span>
            <span className="num" style={{ color: ink.text }}>
              {aud(Number(e.value) || 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NetWorthChart({
  data,
  buckets,
  selected,
  onToggle,
}: {
  data: Point[];
  buckets: string[];
  selected: string[];
  onToggle: (bucket: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("stacked");
  const ink = useChartInk();

  // Empty selection = no filter (everything full colour).
  const isActive = (b: string) => selected.length === 0 || selected.includes(b);
  const seriesColor = (b: string, i: number) => (isActive(b) ? colorFor(b, i) : ink.dim);
  const legend = (
    <Legend
      wrapperStyle={{ fontSize: 11, paddingTop: 8, cursor: "pointer" }}
      iconType="plainline"
      onClick={(o) => onToggle(String((o as { value?: string }).value ?? ""))}
      formatter={(value) => {
        const name = String(value);
        return (
          <span style={{ color: isActive(name) ? "var(--color-text)" : "var(--color-muted)", opacity: isActive(name) ? 1 : 0.7 }}>
            {name}
          </span>
        );
      }}
    />
  );

  const n = data.length;
  const [range, setRange] = useState<[number, number]>(() => [0, Math.max(0, n - 1)]);
  useEffect(() => setRange([0, Math.max(0, n - 1)]), [n]);
  const start = Math.min(range[0], Math.max(0, n - 1));
  const end = Math.min(range[1], Math.max(0, n - 1));
  const view = data.slice(start, end + 1);

  const axisTick = { fill: ink.axis, fontSize: 11 };
  const grid = <CartesianGrid strokeDasharray="3 3" stroke={ink.grid} vertical={false} />;
  const tooltip = <Tooltip content={<NetWorthTooltip ink={ink} />} />;

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Toggle mode={mode} setMode={setMode} />
      </div>

      {n > 1 && (
        <div className="mb-4 px-1">
          <div className="flex items-center justify-between text-xs mb-1.5" style={{ color: "var(--color-muted)" }}>
            <span className="num">{fmtDate(data[start].date, "month")}</span>
            <span style={{ color: "var(--color-muted)" }}>date range</span>
            <span className="num">{fmtDate(data[end].date, "month")}</span>
          </div>
          <RangeSlider
            max={n - 1}
            start={start}
            end={end}
            onChange={(s, e) => setRange([s, e])}
          />
        </div>
      )}

      <ResponsiveContainer width="100%" height={440}>
        {mode === "stacked" ? (
          <AreaChart data={view} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            {grid}
            <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d, "month")} tick={axisTick} minTickGap={28} />
            <YAxis tickFormatter={(v) => compact(v)} tick={axisTick} width={48} />
            {tooltip}
            {legend}
            {buckets.map((b, i) => (
              <Area
                key={b}
                type="monotone"
                dataKey={b}
                name={b}
                stackId="1"
                stroke={seriesColor(b, i)}
                fill={seriesColor(b, i)}
                fillOpacity={isActive(b) ? 0.6 : 0.18}
                strokeWidth={1}
              />
            ))}
          </AreaChart>
        ) : (
          <LineChart data={view} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            {grid}
            <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d, "month")} tick={axisTick} minTickGap={28} />
            <YAxis tickFormatter={(v) => compact(v)} tick={axisTick} width={48} />
            {tooltip}
            {legend}
            {buckets.map((b, i) => (
              <Line
                key={b}
                type="monotone"
                dataKey={b}
                name={b}
                stroke={seriesColor(b, i)}
                strokeWidth={isActive(b) ? 2 : 1}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function RangeSlider({
  max,
  start,
  end,
  onChange,
}: {
  max: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
}) {
  const pct = (i: number) => (max > 0 ? (i / max) * 100 : 0);
  return (
    <div className="range-dual">
      <div className="range-track" />
      <div className="range-fill" style={{ left: `${pct(start)}%`, width: `${pct(end) - pct(start)}%` }} />
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={start}
        aria-label="Start date"
        onChange={(e) => onChange(Math.min(Number(e.target.value), end), end)}
      />
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={end}
        aria-label="End date"
        onChange={(e) => onChange(start, Math.max(Number(e.target.value), start))}
      />
    </div>
  );
}

function Toggle({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const opts: [Mode, string][] = [
    ["stacked", "Stacked total"],
    ["lines", "By asset class"],
  ];
  return (
    <div
      className="inline-flex rounded-lg p-0.5 text-xs"
      style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
    >
      {opts.map(([m, label]) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className="rounded-md px-3 py-1 font-medium transition-colors"
          style={{
            background: mode === m ? "var(--color-accent)" : "transparent",
            color: mode === m ? "var(--color-bg)" : "var(--color-muted)",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
