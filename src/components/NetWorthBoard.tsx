"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { NetWorthChart } from "@/components/NetWorthChart";
import { NetWorthHistory } from "@/components/NetWorthHistory";

type Point = { date: string; total: number; [bucket: string]: number | string };

// Holds the asset-class selection shared between the chart legend and the
// history table (click a legend item to filter; selected columns highlight).
export function NetWorthBoard({ series, buckets }: { series: Point[]; buckets: string[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (b: string) =>
    setSelected((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));

  return (
    <>
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="text-sm font-medium">Composition over time</div>
          {selected.length > 0 && (
            <button onClick={() => setSelected([])} className="text-xs font-medium" style={{ color: "var(--color-accent)" }}>
              Show all
            </button>
          )}
        </div>
        <NetWorthChart data={series} buckets={buckets} selected={selected} onToggle={toggle} />
      </Card>

      <NetWorthHistory series={series} buckets={buckets} selected={selected} />
    </>
  );
}
