"use client";

import { useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  type Timeframe,
  type TimeframePreset,
  timeframeToParams,
} from "@/lib/timeframe";

const PRESETS: { preset: TimeframePreset; label: string }[] = [
  { preset: "this-month", label: "This month" },
  { preset: "last-3mo", label: "3 months" },
  { preset: "ytd", label: "YTD" },
  { preset: "last-12mo", label: "12 months" },
  { preset: "all", label: "All time" },
];

const LS_KEY = "budget-hub-tf";

// Global timeframe selector that drives every range-scoped panel on the Budget
// hub. The selection lives in the URL (so the server component can read it) and
// is mirrored to localStorage so the page reopens on the last-used range.
export function TimeframeControl({
  current,
  nowMonth,
}: {
  current: Timeframe;
  nowMonth: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // On first load with no explicit timeframe in the URL, restore the saved one.
  useEffect(() => {
    if (searchParams.has("tf")) return;
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(LS_KEY) : null;
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as Timeframe;
      if (saved?.preset && saved.preset !== "last-3mo") apply(saved, true);
    } catch {
      /* ignore corrupt value */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function apply(tf: Timeframe, replace = false) {
    if (typeof window !== "undefined") window.localStorage.setItem(LS_KEY, JSON.stringify(tf));
    const params = new URLSearchParams(searchParams.toString());
    // Clear any prior timeframe keys, then set the new ones (preserve e.g. month).
    params.delete("tf");
    params.delete("from");
    params.delete("to");
    for (const [k, v] of Object.entries(timeframeToParams(tf))) params.set(k, v);
    const url = `${pathname}?${params.toString()}`;
    if (replace) router.replace(url);
    else router.push(url);
  }

  const isCustom = current.preset === "custom";
  const from = current.from ?? nowMonth;
  const to = current.to ?? nowMonth;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="inline-flex rounded-lg p-0.5 gap-0.5"
        style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
      >
        {PRESETS.map((p) => {
          const active = current.preset === p.preset;
          return (
            <button
              key={p.preset}
              onClick={() => apply({ preset: p.preset })}
              className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
              style={{
                background: active ? "var(--color-accent)" : "transparent",
                color: active ? "var(--color-bg)" : "var(--color-muted)",
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1"
        style={{
          background: isCustom ? "var(--color-accent-dim)" : "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
        }}
      >
        <input
          type="month"
          value={from}
          max={to}
          onChange={(e) => apply({ preset: "custom", from: e.target.value, to })}
          className="bg-transparent text-xs num outline-none"
          style={{ color: "var(--color-text)" }}
          aria-label="From month"
        />
        <span className="text-xs" style={{ color: "var(--color-muted)" }}>
          →
        </span>
        <input
          type="month"
          value={to}
          min={from}
          max={nowMonth}
          onChange={(e) => apply({ preset: "custom", from, to: e.target.value })}
          className="bg-transparent text-xs num outline-none"
          style={{ color: "var(--color-text)" }}
          aria-label="To month"
        />
      </div>
    </div>
  );
}
