import { aud, pct, fmtDate } from "@/lib/format";
import { BUCKET_ORDER } from "@/lib/constants";
import { getNetWorthSeries } from "@/lib/queries";
import type { InsightDraft } from "./rules";

// Net-worth signals from the snapshot history: milestone crossings, notable
// drops (with the biggest bucket mover named), and concentration in a single
// volatile bucket. Rule-based, no API cost.
export async function computeNetWorthInsights(): Promise<InsightDraft[]> {
  const series = await getNetWorthSeries();
  if (series.length === 0) return [];

  const drafts: InsightDraft[] = [];
  const latest = series[series.length - 1];
  const prev = series.length > 1 ? series[series.length - 2] : null;
  const total = latest.total;
  const period = "rolling";

  if (prev) {
    const change = total - prev.total;
    const pctChange = prev.total ? change / prev.total : 0;

    // Biggest bucket mover between the two snapshots.
    let moverName: string | null = null;
    let moverDelta = 0;
    for (const b of BUCKET_ORDER) {
      const d = Number(latest[b] ?? 0) - Number(prev[b] ?? 0);
      if (Math.abs(d) > Math.abs(moverDelta)) {
        moverDelta = d;
        moverName = b;
      }
    }
    const moverNote = moverName ? ` Biggest move: ${moverName} ${aud(moverDelta, { sign: true })}.` : "";

    // Milestone crossing (round $25k steps, $50k once past $250k).
    const step = total >= 250000 ? 50000 : 25000;
    const crossed = Math.floor(total / step) * step;
    if (change > 0 && crossed > 0 && prev.total < crossed && total >= crossed) {
      drafts.push({
        period,
        type: "net_worth",
        severity: "info",
        title: `Net worth crossed ${aud(crossed)}`,
        body: `Reached ${aud(total)}, up ${aud(change, { sign: true })} since ${fmtDate(prev.date)}.${moverNote}`,
        payload: { total, crossed, change, moverName, moverDelta },
      });
    } else if (pctChange <= -0.03) {
      drafts.push({
        period,
        type: "net_worth",
        severity: pctChange <= -0.08 ? "alert" : "warn",
        title: `Net worth down ${pct(Math.abs(pctChange), 1)}`,
        body: `Fell ${aud(change)} to ${aud(total)} since ${fmtDate(prev.date)}.${moverNote}`,
        payload: { total, change, pctChange, moverName, moverDelta },
      });
    }
  }

  // Concentration in a single volatile bucket.
  const crypto = Number(latest["Crypto"] ?? 0);
  if (total > 0 && crypto / total >= 0.25) {
    const share = crypto / total;
    drafts.push({
      period,
      type: "net_worth",
      severity: share >= 0.4 ? "warn" : "info",
      title: `Crypto is ${pct(share, 0)} of net worth`,
      body: `Crypto holdings of ${aud(crypto)} are ${pct(share, 0)} of your ${aud(total)} net worth — a concentrated, volatile slice.`,
      payload: { crypto, total, share },
    });
  }

  return drafts;
}
