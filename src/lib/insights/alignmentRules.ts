import { aud } from "@/lib/format";
import { topMismatch } from "@/lib/alignment";
import { gatherAlignment, ALIGN_WINDOW_DAYS } from "@/lib/alignment-server";
import type { InsightDraft } from "./rules";

const HM = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
};

// Alignment insight: surface where time + money + votes + energy diverge across
// the Values you've defined. Rule-based & deterministic (no API cost), mirroring
// goalRules. Emits at most one insight summarising the standout mismatch, plus a
// "best aligned" note when things look balanced.
export async function computeAlignmentInsights(): Promise<InsightDraft[]> {
  const report = await gatherAlignment();
  const engaged = report.values.filter((v) => v.minutes > 0 || v.money > 0 || v.votes > 0);
  if (engaged.length < 2) return []; // need a couple of active values to compare

  const mismatch = topMismatch(report);
  if (mismatch) {
    const v = report.values.find((x) => x.name === mismatch.name)!;
    return [
      {
        period: "rolling",
        type: "alignment",
        severity: "warn",
        title: `“${v.name}” is out of balance`,
        body: `Over the last ${ALIGN_WINDOW_DAYS} days, ${v.name} gets a big share of your ${mismatch.high} but little of your ${mismatch.low}: ${HM(v.minutes)} of time, ${aud(v.money)} spent, ${v.votes} habit vote${v.votes === 1 ? "" : "s"}${v.energy != null ? `, ~${v.energy.toFixed(1)}/5 energy on active days` : ""}. Re-balance time and money toward what you say matters.`,
        payload: { value: v.name, high: mismatch.high, low: mismatch.low, gap: mismatch.gap, ...v },
      },
    ];
  }

  // Balanced — celebrate the most engaged value.
  const top = report.values[0];
  return [
    {
      period: "rolling",
      type: "alignment",
      severity: "info",
      title: `Most lived value: ${top.name}`,
      body: `Over the last ${ALIGN_WINDOW_DAYS} days your time, money and habits line up best on ${top.name}: ${HM(top.minutes)}, ${aud(top.money)}, ${top.votes} vote${top.votes === 1 ? "" : "s"}${top.energy != null ? `, ~${top.energy.toFixed(1)}/5 energy` : ""}.`,
      payload: { value: top.name, ...top },
    },
  ];
}
