import { db } from "@/lib/db";
import { aud, fmtDate } from "@/lib/format";
import type { InsightDraft } from "./rules";

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.44;

// Goal pacing: for goals with a target amount and date, compare progress
// against the elapsed share of the goal's lifetime and flag ones falling
// behind. Rule-based, no API cost.
export async function computeGoalInsights(): Promise<InsightDraft[]> {
  const goals = await db.goal.findMany();
  const drafts: InsightDraft[] = [];
  const now = new Date();

  for (const g of goals) {
    if (!g.targetAmount || g.targetAmount <= 0 || !g.targetDate) continue;
    const target = g.targetAmount;
    const current = g.currentAmount;
    const progress = current / target;
    if (progress >= 1) continue; // already there — don't nag

    const remaining = target - current;
    const pctDone = Math.round(progress * 100);
    const monthsLeft = (g.targetDate.getTime() - now.getTime()) / MS_PER_MONTH;
    const perMonth = monthsLeft > 0 ? remaining / monthsLeft : remaining;

    let severity: "info" | "warn" | "alert";
    let body: string;

    if (now > g.targetDate) {
      severity = progress >= 0.95 ? "info" : "warn";
      body = `${aud(current)} of ${aud(target)} (${pctDone}%) — the ${fmtDate(g.targetDate)} target has passed with ${aud(remaining)} still to go.`;
    } else {
      const totalMs = g.targetDate.getTime() - g.createdAt.getTime();
      const elapsed = totalMs > 0 ? Math.min(1, Math.max(0, (now.getTime() - g.createdAt.getTime()) / totalMs)) : 0;
      const ahead = progress - elapsed; // positive = ahead of pace
      if (ahead < -0.1) {
        severity = ahead < -0.25 ? "alert" : "warn";
        body = `${aud(current)} of ${aud(target)} (${pctDone}%), ${Math.round(monthsLeft)} months left — behind pace. ~${aud(perMonth)}/mo gets you to ${fmtDate(g.targetDate)}.`;
      } else {
        severity = "info";
        const lead = ahead > 0.1 ? "ahead of schedule" : "on track";
        body = `${aud(current)} of ${aud(target)} (${pctDone}%) — ${lead} for ${fmtDate(g.targetDate)}. ~${aud(perMonth)}/mo keeps you there.`;
      }
    }

    drafts.push({
      period: "rolling",
      type: "goal_pace",
      severity,
      title: `${g.name}: ${pctDone}% there`,
      body,
      payload: {
        goal: g.name,
        current,
        target,
        progress,
        targetDate: g.targetDate.toISOString().slice(0, 10),
        monthsLeft: Math.round(monthsLeft),
        perMonth: Math.round(perMonth),
      },
    });
  }

  return drafts;
}
