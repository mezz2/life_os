"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { aud, pct } from "@/lib/format";
import type { CatSeries } from "@/lib/queries";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function shortMonth(key: string) {
  const [y, m] = key.split("-");
  return `${MON[Number(m) - 1]} ’${y.slice(2)}`;
}

type Mode = "amount" | "percent" | "variance";

export function YearView({
  months,
  categories,
  incomeMonthly,
  expenseMonthly,
  netMonthly,
  projectedByCat,
  projectedBySub,
}: {
  months: string[];
  categories: CatSeries[];
  incomeMonthly: number[];
  expenseMonthly: number[];
  netMonthly: number[];
  projectedByCat: Record<string, number>;
  projectedBySub: Record<string, number>;
}) {
  const [mode, setMode] = useState<Mode>("amount");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (months.length === 0) {
    return (
      <div className="py-8 text-center text-sm" style={{ color: "var(--color-muted)" }}>
        No data in this period.
      </div>
    );
  }

  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // A single value cell. Income/net rows always render as money (a % "of spend"
  // or budget variance is meaningless for them).
  function cell(actual: number, monthSpend: number, projected: number | null, plain = false) {
    if (plain || mode === "amount") return { text: aud(actual), color: undefined };
    if (mode === "percent") {
      return { text: monthSpend > 0 ? pct(actual / monthSpend, 0) : "—", color: "var(--color-muted)" };
    }
    // variance vs budget: positive = over budget (worse → red)
    if (projected === null || projected === 0) return { text: "—", color: "var(--color-muted)" };
    const v = actual - projected;
    return {
      text: aud(v, { sign: true }),
      color: v > 0 ? "var(--color-negative)" : v < 0 ? "var(--color-positive)" : "var(--color-muted)",
    };
  }

  const num = "px-2 py-1.5 text-right num whitespace-nowrap text-xs";

  // Plain render function (not a component) so React doesn't treat it as a
  // locally-declared component re-created each render.
  function renderRow({
    rowKey,
    label,
    monthly,
    projected,
    indent = false,
    expandable = false,
    isExpanded = false,
    onToggle,
    strong = false,
    plain = false,
    topBorder = false,
    labelColor,
  }: {
    rowKey: string;
    label: string;
    monthly: number[];
    projected: number | null; // monthly projected amount (constant), or null
    indent?: boolean;
    expandable?: boolean;
    isExpanded?: boolean;
    onToggle?: () => void;
    strong?: boolean;
    plain?: boolean;
    topBorder?: boolean;
    labelColor?: string;
  }) {
    const total = sum(monthly);
    const avg = total / months.length;
    const totalProjected = projected === null ? null : projected * months.length;
    const borderStyle = topBorder ? { borderTop: "2px solid var(--color-border)" } : undefined;
    return (
      <tr key={rowKey} style={borderStyle} className="border-t hover:bg-[var(--color-surface-2)]">
        <td
          className={`sticky left-0 z-10 px-2 py-1.5 text-xs whitespace-nowrap ${strong ? "font-semibold" : ""}`}
          style={{ background: "var(--color-surface)", color: labelColor }}
        >
          <button
            onClick={onToggle}
            disabled={!expandable}
            className="flex items-center gap-1"
            style={{ paddingLeft: indent ? 18 : 0, cursor: expandable ? "pointer" : "default" }}
          >
            {expandable && (
              <ChevronRight
                size={13}
                style={{ transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform .15s" }}
              />
            )}
            <span className="truncate max-w-[180px]">{label}</span>
          </button>
        </td>
        {months.map((_, i) => {
          const c = cell(monthly[i], expenseMonthly[i], projected, plain);
          return (
            <td key={i} className={num} style={{ color: c.color }}>
              {c.text}
            </td>
          );
        })}
        <td className={`${num} font-medium`} style={{ borderLeft: "1px solid var(--color-border)" }}>
          {cell(total, sum(expenseMonthly), totalProjected, plain).text}
        </td>
        <td className={num} style={{ color: "var(--color-muted)" }}>
          {plain || mode !== "variance" ? aud(avg) : "—"}
        </td>
      </tr>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-xs" style={{ color: "var(--color-muted)" }}>
          Click a category to expand its subcategories.
        </div>
        <div
          className="inline-flex rounded-lg p-0.5 gap-0.5"
          style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
        >
          {(
            [
              ["amount", "$"],
              ["percent", "% of spend"],
              ["variance", "vs budget"],
            ] as [Mode, string][]
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
              style={{
                background: mode === m ? "var(--color-accent)" : "transparent",
                color: mode === m ? "var(--color-bg)" : "var(--color-muted)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ color: "var(--color-muted)" }}>
              <th className="sticky left-0 z-10 px-2 py-1.5 text-left text-xs font-medium" style={{ background: "var(--color-surface)" }}>
                Category
              </th>
              {months.map((m) => (
                <th key={m} className="px-2 py-1.5 text-right text-xs font-medium whitespace-nowrap">
                  {shortMonth(m)}
                </th>
              ))}
              <th className="px-2 py-1.5 text-right text-xs font-medium" style={{ borderLeft: "1px solid var(--color-border)" }}>
                Total
              </th>
              <th className="px-2 py-1.5 text-right text-xs font-medium">Avg/mo</th>
            </tr>
          </thead>
          <tbody>
            {categories.flatMap((c) => {
              const isOpen = expanded.has(c.id);
              const rows = [
                renderRow({
                  rowKey: c.id,
                  label: c.name,
                  monthly: c.monthly,
                  projected: projectedByCat[c.id] ?? null,
                  expandable: c.subs.length > 0,
                  isExpanded: isOpen,
                  onToggle: () => toggle(c.id),
                }),
              ];
              if (isOpen) {
                for (const s of c.subs) {
                  rows.push(
                    renderRow({
                      rowKey: `${c.id}:${s.id}`,
                      label: s.group ? `${s.group} › ${s.name}` : s.name,
                      monthly: s.monthly,
                      projected: projectedBySub[s.id] ?? null,
                      indent: true,
                      labelColor: "var(--color-muted)",
                    }),
                  );
                }
              }
              return rows;
            })}
            {renderRow({ rowKey: "__income", label: "Income", monthly: incomeMonthly, projected: null, strong: true, plain: true, topBorder: true, labelColor: "var(--color-positive)" })}
            {renderRow({ rowKey: "__net", label: "Net / Savings", monthly: netMonthly, projected: null, strong: true, plain: true, labelColor: "var(--color-accent)" })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
