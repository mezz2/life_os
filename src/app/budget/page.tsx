import { PageHeader } from "@/components/ui";
import { MonthPicker } from "@/components/MonthPicker";
import { BudgetEditor, type BudgetCat } from "@/components/BudgetEditor";
import { TimeframeControl } from "@/components/budget/TimeframeControl";
import { TabbedHub, type TabDef } from "@/components/budget/TabbedHub";
import { Section } from "@/components/budget/Section";
import { MoneyMap } from "@/components/budget/MoneyMap";
import { YearView } from "@/components/budget/YearView";
import {
  PercentBreakdown,
  CashflowPanel,
  SpendTrend,
  TopMovers,
} from "@/components/budget/AnalysisPanels";
import { KpiStrip } from "@/components/budget/Overview";
import { InsightSlot } from "@/components/budget/InsightSlot";
import { InsightCard } from "@/components/InsightCard";
import { GenerateInsights } from "@/components/GenerateInsights";
import { groupBySlot } from "@/lib/insights/store";
import type { CategoryTree } from "@/components/TransactionsClient";
import { db } from "@/lib/db";
import {
  getMonthlyActuals,
  getMonthlyTransactionsBySub,
  getCategorySpendMatrix,
  getFinancePeriod,
  getEarliestTransactionMonth,
  currentMonthKey,
} from "@/lib/queries";
import { monthKey } from "@/lib/format";
import { CATEGORY_COLORS } from "@/lib/constants";
import {
  resolveTimeframe,
  timeframeFromParams,
} from "@/lib/timeframe";
import type { SubTrend } from "@/components/BudgetEditor";

export const dynamic = "force-dynamic";

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; tf?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const now = currentMonthKey();
  const month = sp.month ?? now;

  const timeframe = timeframeFromParams(sp);
  const earliestMonth = await getEarliestTransactionMonth();
  const range = resolveTimeframe(timeframe, { nowMonth: now, earliestMonth });

  const [period, cats, budgetLines, actuals, txnsBySub, matrix, txnDates, insightRows] =
    await Promise.all([
      getFinancePeriod(range),
      db.category.findMany({
        orderBy: { sortOrder: "asc" },
        include: { subcategories: { orderBy: { sortOrder: "asc" } } },
      }),
      db.budgetLine.findMany({ where: { periodType: "monthly" } }),
      getMonthlyActuals(month),
      getMonthlyTransactionsBySub(month),
      getCategorySpendMatrix(),
      db.transaction.findMany({ select: { date: true }, orderBy: { date: "desc" }, take: 5000 }),
      db.insight.findMany({ where: { dismissed: false }, orderBy: [{ generatedAt: "desc" }] }),
    ]);

  const insights = insightRows.map((i) => ({ ...i, generatedAt: i.generatedAt.toISOString() }));
  const slots = groupBySlot(insights, "budget");

  // ----- Plan panel data (month-scoped, unchanged from the prior Budget tab) -----
  const mIdx = matrix.months.indexOf(month);
  const trendBySub: Record<string, SubTrend> = {};
  for (const c of matrix.categories) {
    for (const s of c.subs) {
      const arr = s.monthly;
      const idx = mIdx >= 0 ? mIdx : arr.length - 1;
      const cur = arr[idx] ?? 0;
      const prev = arr[idx - 1];
      const yoy = arr[idx - 12];
      const spark = arr.slice(Math.max(0, idx - 11), idx + 1);
      trendBySub[s.id] = {
        spark,
        mom: prev === undefined || prev === 0 ? null : (cur - prev) / prev,
        yoy: yoy === undefined || yoy === 0 ? null : (cur - yoy) / yoy,
      };
    }
  }
  const colorByCat: Record<string, string> = {};
  cats
    .filter((c) => c.kind === "expense")
    .forEach((c, i) => (colorByCat[c.id] = CATEGORY_COLORS[i % CATEGORY_COLORS.length]));

  const budgetBySub = new Map(budgetLines.map((b) => [b.subcategoryId, b.projectedAmount]));
  // Projected (monthly) per sub + per expense category, for the year view's
  // "vs budget" mode.
  const projectedBySub: Record<string, number> = Object.fromEntries(budgetBySub);
  const projectedByCat: Record<string, number> = {};
  for (const c of cats) {
    if (c.kind !== "expense") continue;
    projectedByCat[c.id] = c.subcategories.reduce((s, sub) => s + (budgetBySub.get(sub.id) ?? 0), 0);
  }
  const months = [...new Set([now, ...txnDates.map((t) => monthKey(t.date))])].sort((a, b) =>
    b.localeCompare(a),
  );

  const tree: CategoryTree = cats.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    subs: c.subcategories.map((s) => ({ id: s.id, name: s.name, group: s.group })),
  }));

  const editorCats: BudgetCat[] = cats
    .filter((c) => c.kind === "expense")
    .map((c) => ({
      id: c.id,
      name: c.name,
      subs: c.subcategories.map((s) => ({
        id: s.id,
        name: s.name,
        group: s.group,
        projected: budgetBySub.get(s.id) ?? 0,
        actual: Math.abs(actuals.get(s.id) ?? 0),
      })),
    }));

  // ----- Tabs: each is a bento grid of Sections. Range-scoped panels use
  // `period`; Plan stays month-scoped. ("full" spans both grid columns.) -----
  const tabs: TabDef[] = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <>
          <Section title="Overview" subtitle={range.label} span="full">
            <KpiStrip incomeTotal={period.incomeTotal} expenseTotal={period.expenseTotal} />
          </Section>
          {slots.overview?.length ? (
            <div className="md:col-span-2 space-y-3">
              {slots.overview.map((i) => (
                <InsightCard key={i.id} insight={i} />
              ))}
            </div>
          ) : null}
          <Section title="% of spend" subtitle="Share of outflow by category" span="full">
            <PercentBreakdown categories={period.expenseCategories} expenseTotal={period.expenseTotal} />
          </Section>
        </>
      ),
    },
    {
      id: "flows",
      label: "Flows",
      content: (
        <>
          <Section title="Money map" subtitle="Where your money flows" span="full">
            <MoneyMap
              income={period.incomeCategories}
              expense={period.expenseCategories}
              incomeTotal={period.incomeTotal}
              expenseTotal={period.expenseTotal}
            />
          </Section>
          <Section
            title="Top movers & merchants"
            subtitle="Biggest jumps, merchants & largest txns"
            span={slots.flows?.length ? "half" : "full"}
          >
            <TopMovers
              months={period.months}
              categories={period.expenseCategories}
              topMerchants={period.topMerchants}
              largestTxns={period.largestTxns}
            />
          </Section>
          {slots.flows?.length ? (
            <Section title="Insights" subtitle="Worth a look" span="half">
              <InsightSlot insights={slots.flows} />
            </Section>
          ) : null}
        </>
      ),
    },
    {
      id: "trends",
      label: "Trends",
      content: (
        <>
          <InsightSlot insights={slots.trends} className="md:col-span-2" />
          <Section title="Savings rate & cashflow" subtitle="Income vs expense vs net" span="full">
            <CashflowPanel
              months={period.months}
              incomeMonthly={period.incomeMonthly}
              expenseMonthly={period.expenseMonthly}
              netMonthly={period.netMonthly}
            />
          </Section>
          <Section title="Spend trend" subtitle="By category over time" span="full">
            <SpendTrend months={period.months} categories={period.expenseCategories} />
          </Section>
          <Section title="Year view" subtitle="Month-by-month actuals" span="full">
            <YearView
              months={period.months}
              categories={period.expenseCategories}
              incomeMonthly={period.incomeMonthly}
              expenseMonthly={period.expenseMonthly}
              netMonthly={period.netMonthly}
              projectedByCat={projectedByCat}
              projectedBySub={projectedBySub}
            />
          </Section>
        </>
      ),
    },
    {
      id: "plan",
      label: "Plan",
      content: (
        <>
          <InsightSlot insights={slots.plan} className="md:col-span-2" />
          <Section
            title="Plan budgets"
            subtitle="Projected vs actual — monthly"
            action={<MonthPicker months={months} value={month} />}
            span="full"
          >
            <BudgetEditor
              categories={editorCats}
              txnsBySub={txnsBySub}
              tree={tree}
              trends={trendBySub}
              colorByCat={colorByCat}
            />
          </Section>
        </>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Budget"
        subtitle="Your money, end to end — flows, trends, plan and insights"
        action={
          <div className="flex items-center gap-2">
            <TimeframeControl current={timeframe} nowMonth={now} />
            <GenerateInsights />
          </div>
        }
      />
      <TabbedHub tabs={tabs} />
      <p className="text-xs mt-6" style={{ color: "var(--color-muted)" }}>
        The timeframe up top drives every tab except Plan, which stays monthly.
      </p>
    </div>
  );
}
