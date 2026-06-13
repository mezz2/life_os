import { db } from "@/lib/db";
import { aud, monthLabel } from "@/lib/format";
import { getMonthFlow, getMonthlySpendSeries, getLatestNetWorth, currentMonthKey } from "@/lib/queries";
import type { InsightDraft } from "./rules";

// Compose a narrative "what I noticed + how to lean your spend" insight via Claude.
// Returns null if no API key or on failure (rules-only still works).
export async function composeNarrative(rules: InsightDraft[]): Promise<InsightDraft | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const month = currentMonthKey();
  const [flow, spendSeries, nw, goals] = await Promise.all([
    getMonthFlow(month),
    getMonthlySpendSeries(12),
    getLatestNetWorth(),
    db.goal.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  // Top categories last 3 months
  const txns = await db.transaction.findMany({
    where: { subcategory: { category: { kind: "expense" } } },
    include: { subcategory: { select: { name: true, category: { select: { name: true } } } } },
    orderBy: { date: "desc" },
    take: 1500,
  });
  const byCat = new Map<string, number>();
  for (const x of txns) {
    const k = x.subcategory ? `${x.subcategory.category.name} › ${x.subcategory.name}` : "Uncategorised";
    byCat.set(k, (byCat.get(k) ?? 0) + Math.abs(x.amount));
  }
  const topCats = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

  // Fat input is cheap (input is ~$3/1M); it sharpens the short output. We hand
  // the model net worth, goal progress, 12 months of spend, and the full
  // rule-signal text (not just titles) so it can cite exact numbers.
  const context = {
    month: monthLabel(month),
    income: aud(flow.income),
    expenses: aud(flow.expense),
    savingsRate: `${Math.round(flow.savingsRate * 100)}%`,
    netWorth: nw ? aud(nw.latest.total) : "n/a",
    netWorthChange: nw
      ? `${aud(nw.change, { sign: true })} (${Math.round(nw.changePct * 100)}%) since last snapshot`
      : "n/a",
    monthlySpend12: spendSeries.map((s) => `${s.month}: ${aud(s.spend)}`),
    topCategories: topCats.map(([k, v]) => `${k}: ${aud(v)}`),
    goals: goals
      .filter((g) => g.targetAmount)
      .map(
        (g) =>
          `${g.name}: ${aud(g.currentAmount)} / ${aud(g.targetAmount!)}${g.targetDate ? ` by ${g.targetDate.toISOString().slice(0, 10)}` : ""}`,
      ),
    signals: rules.map((r) => r.body),
  };

  const prompt = `You are the financial insights engine inside "LifeOS", a personal finance app for someone in Australia saving toward goals like a first property, extra super, and a stock portfolio.

Here is their recent data:
${JSON.stringify(context, null, 2)}

Write 3–4 short, punchy, specific bullet points — the highest-impact things to act on this month. Rules:
- Each bullet ≤ 20 words. Lead with the action or finding; name a concrete dollar figure or category from the data.
- Prioritise impact: overspends, pacing toward goals, savings rate, large swings in spend or net worth.
- No preamble, no greeting, no encouragement filler.
- Plain text, one bullet per line starting with "• ". Australian dollars.`;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { text: string }).text)
      .join("")
      .trim();
    if (!text) return null;
    return {
      period: month,
      type: "narrative",
      severity: "info",
      title: `${monthLabel(month)} insight`,
      body: text,
    };
  } catch (e) {
    console.error("Narrative generation failed:", e);
    return null;
  }
}
