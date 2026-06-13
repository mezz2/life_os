"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, AlertTriangle, TrendingUp, Repeat, PiggyBank, Sparkles, Calendar, Receipt, Target, LineChart } from "lucide-react";

const ICONS: Record<string, typeof Sparkles> = {
  overspend: AlertTriangle,
  spike: TrendingUp,
  subscription: Repeat,
  savings_rate: PiggyBank,
  narrative: Sparkles,
  yoy: Calendar,
  large_txn: Receipt,
  goal_pace: Target,
  net_worth: LineChart,
};

export type InsightDTO = {
  id: string;
  type: string;
  severity: string;
  title: string;
  body: string;
  generatedAt: string;
};

export function InsightCard({
  insight,
  dismissable = true,
  compact = false,
}: {
  insight: InsightDTO;
  dismissable?: boolean;
  compact?: boolean;
}) {
  const [hidden, setHidden] = useState(false);
  const router = useRouter();
  const Icon = ICONS[insight.type] ?? Sparkles;
  const color =
    insight.severity === "alert"
      ? "var(--color-negative)"
      : insight.severity === "warn"
        ? "var(--color-warn)"
        : insight.type === "narrative"
          ? "var(--color-accent)"
          : "var(--color-muted)";

  if (hidden) return null;

  async function dismiss() {
    setHidden(true);
    await fetch("/api/insights", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: insight.id }),
    });
    router.refresh();
  }

  return (
    <div
      className={`card flex gap-3 ${compact ? "p-3" : "p-4"}`}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="shrink-0 mt-0.5" style={{ color }}>
        <Icon size={compact ? 16 : 18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`font-medium ${compact ? "text-xs" : "text-sm"}`}>{insight.title}</div>
        <div
          className={`mt-1 whitespace-pre-line ${compact ? "text-xs" : "text-sm"}`}
          style={{ color: "var(--color-muted)" }}
        >
          {insight.body}
        </div>
      </div>
      {dismissable && (
        <button onClick={dismiss} className="shrink-0 self-start opacity-40 hover:opacity-100">
          <X size={15} />
        </button>
      )}
    </div>
  );
}
