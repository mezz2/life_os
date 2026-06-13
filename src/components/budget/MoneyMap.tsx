"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sankey, sankeyLinkHorizontal, sankeyJustify } from "d3-sankey";
import { aud, pct } from "@/lib/format";
import { CATEGORY_COLORS } from "@/lib/constants";
import type { CatSeries } from "@/lib/queries";

type Depth = "categories" | "subcategories";
type NodeKind = "source" | "hub" | "expense" | "subcat" | "savings" | "drawdown";

type RawNode = { id: string; name: string; kind: NodeKind; color: string };
type RawLink = { source: number; target: number; value: number };

const COLORS = {
  income: "#34d399",
  hub: "#22d3ee",
  savings: "#34d399",
  drawdown: "#f87171",
};

// Build the sankey graph for the chosen depth. Structure:
//   income sources → Income hub → expense categories → subcategories
// with a Savings/Net terminal node, or — when spending exceeds income — a
// flagged Drawdown source feeding the hub to keep the diagram balanced.
function buildGraph(
  income: CatSeries[],
  expense: CatSeries[],
  incomeTotal: number,
  expenseTotal: number,
  depth: Depth,
) {
  const nodes: RawNode[] = [];
  const links: RawLink[] = [];
  const add = (n: RawNode) => nodes.push(n) - 1;

  const hub = add({ id: "__hub", name: "Income", kind: "hub", color: COLORS.hub });

  for (const c of income) {
    if (c.total <= 0) continue;
    const si = add({ id: `inc:${c.id}`, name: c.name, kind: "source", color: COLORS.income });
    links.push({ source: si, target: hub, value: c.total });
  }

  expense.forEach((c, i) => {
    if (c.total <= 0) return;
    const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
    const ci = add({ id: `exp:${c.id}`, name: c.name, kind: "expense", color });
    links.push({ source: hub, target: ci, value: c.total });
    if (depth === "subcategories") {
      for (const s of c.subs) {
        if (s.total <= 0) continue;
        const subi = add({ id: `sub:${s.id}`, name: s.name, kind: "subcat", color });
        links.push({ source: ci, target: subi, value: s.total });
      }
    }
  });

  const net = incomeTotal - expenseTotal;
  if (net > 0) {
    const sv = add({ id: "__savings", name: "Savings / Net", kind: "savings", color: COLORS.savings });
    links.push({ source: hub, target: sv, value: net });
  } else if (net < 0) {
    const dd = add({ id: "__drawdown", name: "Drawdown (overspend)", kind: "drawdown", color: COLORS.drawdown });
    links.push({ source: dd, target: hub, value: -net });
  }

  return { nodes, links, throughput: Math.max(incomeTotal, expenseTotal) };
}

export function MoneyMap({
  income,
  expense,
  incomeTotal,
  expenseTotal,
}: {
  income: CatSeries[];
  expense: CatSeries[];
  incomeTotal: number;
  expenseTotal: number;
}) {
  const [depth, setDepth] = useState<Depth>("categories");
  const [focus, setFocus] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; label: string; value: string; share: string } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const raw = useMemo(
    () => buildGraph(income, expense, incomeTotal, expenseTotal, depth),
    [income, expense, incomeTotal, expenseTotal, depth],
  );

  // Height scales with the busiest column so nodes never overlap.
  const colCount = useMemo(() => {
    const counts = new Map<string, number>();
    // approximate column membership by kind for sizing only
    raw.nodes.forEach((n) => {
      const col = n.kind === "source" || n.kind === "drawdown" ? 0 : n.kind === "hub" ? 1 : n.kind === "subcat" ? 3 : 2;
      counts.set(String(col), (counts.get(String(col)) ?? 0) + 1);
    });
    return Math.max(1, ...counts.values());
  }, [raw.nodes]);
  const height = Math.min(760, Math.max(280, colCount * 30 + 40));

  const graph = useMemo(() => {
    if (raw.nodes.length <= 1 || raw.links.length === 0) return null;
    const layout = sankey<RawNode, RawLink>()
      .nodeWidth(13)
      .nodePadding(14)
      .nodeAlign(sankeyJustify)
      .extent([
        [148, 10],
        [Math.max(320, width) - 168, height - 10],
      ]);
    // d3-sankey mutates its input — clone first.
    return layout({
      nodes: raw.nodes.map((n) => ({ ...n })),
      links: raw.links.map((l) => ({ ...l })),
    });
  }, [raw, width, height]);

  if (!graph) {
    return (
      <div className="py-10 text-center text-sm" style={{ color: "var(--color-muted)" }}>
        No income or spending in this period to map.
      </div>
    );
  }

  const linkPath = sankeyLinkHorizontal<RawNode, RawLink>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isConnected = (l: any) => !focus || l.source.id === focus || l.target.id === focus;

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-xs" style={{ color: "var(--color-muted)" }}>
          {focus ? "Click background to clear focus" : "Click a node to focus its flows"}
        </div>
        <div
          className="inline-flex rounded-lg p-0.5 gap-0.5"
          style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
        >
          {(["categories", "subcategories"] as Depth[]).map((d) => (
            <button
              key={d}
              onClick={() => setDepth(d)}
              className="rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors"
              style={{
                background: depth === d ? "var(--color-accent)" : "transparent",
                color: depth === d ? "var(--color-bg)" : "var(--color-muted)",
              }}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${Math.max(320, width)} ${height}`}
        onClick={() => setFocus(null)}
        style={{ overflow: "visible" }}
      >
        <g fill="none">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {graph.links.map((l: any, i) => (
            <path
              key={i}
              d={linkPath(l) ?? undefined}
              stroke={l.target.color ?? l.source.color}
              strokeOpacity={isConnected(l) ? 0.4 : 0.07}
              strokeWidth={Math.max(1, l.width)}
              onMouseMove={(e) => {
                const r = wrapRef.current!.getBoundingClientRect();
                setHover({
                  x: e.clientX - r.left,
                  y: e.clientY - r.top,
                  label: `${l.source.name} → ${l.target.name}`,
                  value: aud(l.value),
                  share: raw.throughput ? pct(l.value / raw.throughput, 1) : "",
                });
              }}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </g>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {graph.nodes.map((n: any) => {
          const h = Math.max(1, n.y1 - n.y0);
          const leftSide = n.x0 < (Math.max(320, width)) / 2;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const dim = focus && n.id !== focus && !graph.links.some((l: any) => (l.source.id === focus && l.target.id === n.id) || (l.target.id === focus && l.source.id === n.id));
          return (
            <g key={n.id} style={{ opacity: dim ? 0.28 : 1 }}>
              <rect
                x={n.x0}
                y={n.y0}
                width={n.x1 - n.x0}
                height={h}
                fill={n.color}
                rx={2}
                cursor="pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setFocus((f) => (f === n.id ? null : n.id));
                }}
                onMouseMove={(e) => {
                  const r = wrapRef.current!.getBoundingClientRect();
                  setHover({
                    x: e.clientX - r.left,
                    y: e.clientY - r.top,
                    label: n.name,
                    value: aud(n.value),
                    share: raw.throughput ? pct(n.value / raw.throughput, 1) : "",
                  });
                }}
                onMouseLeave={() => setHover(null)}
              />
              <text
                x={leftSide ? n.x1 + 7 : n.x0 - 7}
                y={(n.y0 + n.y1) / 2}
                dy="0.35em"
                textAnchor={leftSide ? "start" : "end"}
                fontSize={11}
                fill="var(--color-text)"
                style={{ pointerEvents: "none" }}
              >
                {n.name}
                <tspan fill="var(--color-muted)"> {aud(n.value)}</tspan>
              </text>
            </g>
          );
        })}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: Math.min(hover.x + 12, (width || 320) - 160),
            top: hover.y + 12,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div className="font-medium">{hover.label}</div>
          <div className="num" style={{ color: "var(--color-muted)" }}>
            {hover.value}
            {hover.share && ` · ${hover.share} of flow`}
          </div>
        </div>
      )}
    </div>
  );
}
