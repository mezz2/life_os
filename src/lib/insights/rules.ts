import { db } from "@/lib/db";
import { monthKey, monthLabel, aud } from "@/lib/format";
import { computeGoalInsights } from "./goalRules";
import { computeNetWorthInsights } from "./netWorthRules";
import { computeAlignmentInsights } from "./alignmentRules";

export type InsightDraft = {
  period: string;
  type: string;
  severity: "info" | "warn" | "alert";
  title: string;
  body: string;
  payload?: unknown;
};

function previousMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setUTCDate(1);
  for (let i = 0; i < n; i++) {
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    d.setUTCMonth(d.getUTCMonth() - 1);
  }
  return out;
}

type TxnLite = {
  date: Date;
  amount: number;
  description: string;
  sub: string | null;
  group: string | null;
  category: string | null;
  kind: string | null;
};

export async function computeInsights(): Promise<InsightDraft[]> {
  const txns = await db.transaction.findMany({
    include: { subcategory: { select: { name: true, group: true, category: { select: { name: true, kind: true } } } } },
  });
  const t: TxnLite[] = txns.map((x) => ({
    date: x.date,
    amount: x.amount,
    description: x.description || x.rawDescription,
    sub: x.subcategory?.name ?? null,
    group: x.subcategory?.group ?? null,
    category: x.subcategory?.category.name ?? null,
    kind: x.subcategory?.category.kind ?? null,
  }));

  // Goal + net-worth signals are independent of transactions, so they run even
  // when no transactions have been imported yet.
  const externalDrafts = [
    ...(await computeGoalInsights()),
    ...(await computeNetWorthInsights()),
    ...(await computeAlignmentInsights()),
  ];

  if (t.length === 0) return externalDrafts;

  const drafts: InsightDraft[] = [];
  const months = previousMonths(13);
  const thisMonth = months[0];
  const lastMonth = months[1];

  // Spend per month per subcategory (expenses, positive magnitude)
  const spend = new Map<string, Map<string, number>>(); // month -> sub -> amount
  const monthTotal = new Map<string, number>();
  const incomeByMonth = new Map<string, number>();
  for (const x of t) {
    const mk = monthKey(x.date);
    if (x.kind === "income" || (!x.kind && x.amount > 0)) {
      incomeByMonth.set(mk, (incomeByMonth.get(mk) ?? 0) + Math.abs(x.amount));
      continue;
    }
    if (x.kind === "expense" || (!x.kind && x.amount < 0)) {
      const key = x.sub ?? "Uncategorised";
      if (!spend.has(mk)) spend.set(mk, new Map());
      const m = spend.get(mk)!;
      m.set(key, (m.get(key) ?? 0) + Math.abs(x.amount));
      monthTotal.set(mk, (monthTotal.get(mk) ?? 0) + Math.abs(x.amount));
    }
  }

  // 1) Budget overspend (current month vs monthly budget lines)
  const budgetLines = await db.budgetLine.findMany({
    where: { periodType: "monthly" },
    include: { subcategory: { select: { name: true } } },
  });
  const now = new Date();
  const dayOfMonth = now.getUTCDate();
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const elapsed = dayOfMonth / daysInMonth;
  const curSpend = spend.get(thisMonth) ?? new Map();
  for (const bl of budgetLines) {
    const actual = curSpend.get(bl.subcategory.name) ?? 0;
    if (actual > bl.projectedAmount && bl.projectedAmount > 0) {
      drafts.push({
        period: thisMonth,
        type: "overspend",
        severity: actual > bl.projectedAmount * 1.25 ? "alert" : "warn",
        title: `Over budget on ${bl.subcategory.name}`,
        body: `You've spent ${aud(actual)} of your ${aud(bl.projectedAmount)} ${bl.subcategory.name} budget this month — ${aud(actual - bl.projectedAmount)} over.`,
        payload: { sub: bl.subcategory.name, actual, projected: bl.projectedAmount },
      });
    } else if (bl.projectedAmount > 0 && elapsed < 0.85 && actual > bl.projectedAmount * elapsed * 1.3) {
      drafts.push({
        period: thisMonth,
        type: "overspend",
        severity: "warn",
        title: `Pacing high on ${bl.subcategory.name}`,
        body: `At ${aud(actual)} ${Math.round(elapsed * 100)}% through the month, you're on track to overshoot the ${aud(bl.projectedAmount)} budget.`,
        payload: { sub: bl.subcategory.name, actual, projected: bl.projectedAmount, elapsed },
      });
    }
  }

  // 2) Category spike vs trailing 3-month average
  const trailing = months.slice(1, 4);
  const lastSpend = spend.get(lastMonth);
  if (lastSpend) {
    for (const [sub, amount] of lastSpend) {
      const hist = trailing.slice(1).map((m) => spend.get(m)?.get(sub) ?? 0);
      const avg = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : 0;
      if (avg > 50 && amount > avg * 1.5 && amount - avg > 80) {
        drafts.push({
          period: lastMonth,
          type: "spike",
          severity: "warn",
          title: `${sub} spending jumped`,
          body: `${monthLabel(lastMonth)} ${sub} was ${aud(amount)} vs a ${aud(avg)} recent average (+${Math.round((amount / avg - 1) * 100)}%).`,
          payload: { sub, amount, avg },
        });
      }
    }
  }

  // 3) Subscription / recurring detection
  const byMerchant = new Map<string, { months: Set<string>; total: number; amounts: number[] }>();
  for (const x of t) {
    if (!(x.kind === "expense" || (!x.kind && x.amount < 0))) continue;
    const key = x.description.toLowerCase().replace(/\d+/g, "").trim().slice(0, 24);
    if (!key) continue;
    if (!byMerchant.has(key)) byMerchant.set(key, { months: new Set(), total: 0, amounts: [] });
    const e = byMerchant.get(key)!;
    e.months.add(monthKey(x.date));
    e.total += Math.abs(x.amount);
    e.amounts.push(Math.abs(x.amount));
  }
  const subs = [...byMerchant.entries()]
    .filter(([, e]) => e.months.size >= 3 && e.amounts.length >= 3)
    .map(([k, e]) => ({ name: k, monthly: e.total / e.months.size, count: e.months.size }))
    .sort((a, b) => b.monthly - a.monthly)
    .slice(0, 8);
  if (subs.length) {
    const totalMonthly = subs.reduce((s, x) => s + x.monthly, 0);
    drafts.push({
      period: "rolling",
      type: "subscription",
      severity: totalMonthly > 200 ? "warn" : "info",
      title: `${subs.length} recurring payments ≈ ${aud(totalMonthly)}/mo`,
      body: `Recurring charges detected: ${subs.slice(0, 5).map((s) => `${s.name.trim()} (${aud(s.monthly)})`).join(", ")}. That's ${aud(totalMonthly * 12)}/year — worth a periodic cull.`,
      payload: subs,
    });
  }

  // 4) Savings rate (last completed month)
  const inc = incomeByMonth.get(lastMonth) ?? 0;
  const exp = monthTotal.get(lastMonth) ?? 0;
  if (inc > 0) {
    const rate = (inc - exp) / inc;
    const prevInc = incomeByMonth.get(months[2]) ?? 0;
    const prevExp = monthTotal.get(months[2]) ?? 0;
    const prevRate = prevInc > 0 ? (prevInc - prevExp) / prevInc : null;
    drafts.push({
      period: lastMonth,
      type: "savings_rate",
      severity: rate < 0.1 ? "alert" : rate < 0.25 ? "warn" : "info",
      title: `Savings rate ${Math.round(rate * 100)}% in ${monthLabel(lastMonth)}`,
      body: `You saved ${aud(inc - exp)} of ${aud(inc)} income${prevRate != null ? ` (vs ${Math.round(prevRate * 100)}% the month before)` : ""}.`,
      payload: { rate, income: inc, expense: exp, prevRate },
    });
  }

  // 5) Year-over-year (last month vs same month last year)
  const yoyKey = (() => {
    const [y, m] = lastMonth.split("-").map(Number);
    return `${y - 1}-${String(m).padStart(2, "0")}`;
  })();
  const yoyThis = monthTotal.get(lastMonth);
  const yoyPrev = monthTotal.get(yoyKey);
  if (yoyThis && yoyPrev && yoyPrev > 0) {
    const delta = (yoyThis - yoyPrev) / yoyPrev;
    if (Math.abs(delta) > 0.15) {
      drafts.push({
        period: lastMonth,
        type: "yoy",
        severity: "info",
        title: `Spending ${delta > 0 ? "up" : "down"} ${Math.round(Math.abs(delta) * 100)}% YoY`,
        body: `${monthLabel(lastMonth)} total spend ${aud(yoyThis)} vs ${aud(yoyPrev)} a year earlier.`,
        payload: { yoyThis, yoyPrev, delta },
      });
    }
  }

  // 6) Unusual large transactions (last 30 days)
  const cutoff = new Date(now.getTime() - 30 * 86400000);
  const expenses = t.filter((x) => x.amount < 0).map((x) => Math.abs(x.amount));
  if (expenses.length > 10) {
    const mean = expenses.reduce((a, b) => a + b, 0) / expenses.length;
    const sd = Math.sqrt(expenses.reduce((a, b) => a + (b - mean) ** 2, 0) / expenses.length);
    const threshold = Math.max(mean + 2 * sd, 300);
    const big = t
      .filter((x) => x.amount < 0 && Math.abs(x.amount) >= threshold && x.date >= cutoff)
      .sort((a, b) => a.amount - b.amount)
      .slice(0, 5);
    for (const x of big) {
      drafts.push({
        period: thisMonth,
        type: "large_txn",
        severity: "info",
        title: `Large transaction: ${aud(Math.abs(x.amount))}`,
        body: `${x.description} on ${x.date.toISOString().slice(0, 10)}${x.sub ? ` (${x.sub})` : ""}.`,
        payload: { amount: x.amount, description: x.description },
      });
    }
  }

  return [...drafts, ...externalDrafts];
}
