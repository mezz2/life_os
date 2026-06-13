import { db } from "./db";
import { monthKey } from "./format";
import { BUCKET_ORDER } from "./constants";
import type { ResolvedRange } from "./timeframe";

export { BUCKET_ORDER } from "./constants";

export type BucketMeta = { name: string; isLiability: boolean };

// The live set of net-worth buckets: built-in defaults plus any custom asset
// classes / liabilities the user has added. A bucket is treated as a liability
// when its most recent entry is negative.
export async function getNetWorthBuckets(): Promise<BucketMeta[]> {
  const entries = await db.netWorthEntry.findMany({
    select: { bucket: true, amount: true },
    orderBy: { snapshot: { date: "desc" } },
  });
  const latest = new Map<string, number>();
  for (const e of entries) if (!latest.has(e.bucket)) latest.set(e.bucket, e.amount);

  const names = new Set<string>([...BUCKET_ORDER, ...latest.keys()]);
  const metas: BucketMeta[] = [...names].map((name) => ({
    name,
    isLiability: (latest.get(name) ?? 0) < 0,
  }));
  // Assets first (defaults in their order, then custom alphabetically), liabilities last.
  const rank = (m: BucketMeta): [number, number, string] => {
    const di = BUCKET_ORDER.indexOf(m.name);
    if (m.isLiability) return [2, 0, m.name];
    if (di >= 0) return [0, di, m.name];
    return [1, 0, m.name];
  };
  metas.sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    return ra[0] - rb[0] || ra[1] - rb[1] || ra[2].localeCompare(rb[2]);
  });
  return metas;
}

export type SnapshotPoint = { date: string; total: number; [bucket: string]: number | string };

export async function getNetWorthSeries(): Promise<SnapshotPoint[]> {
  const snaps = await db.netWorthSnapshot.findMany({
    orderBy: { date: "asc" },
    include: { entries: true },
  });
  return snaps.map((s) => {
    const point: SnapshotPoint = { date: s.date.toISOString().slice(0, 10), total: 0 };
    let total = 0;
    for (const e of s.entries) {
      point[e.bucket] = e.amount;
      total += e.amount;
    }
    point.total = total;
    return point;
  });
}

export async function getLatestNetWorth() {
  const series = await getNetWorthSeries();
  if (series.length === 0) return null;
  const latest = series[series.length - 1];
  const prev = series.length > 1 ? series[series.length - 2] : null;
  return {
    latest,
    prev,
    change: prev ? latest.total - prev.total : 0,
    changePct: prev && prev.total ? (latest.total - prev.total) / prev.total : 0,
  };
}

export type CategoryTree = {
  id: string;
  name: string;
  kind: string;
  subs: { id: string; name: string; group: string | null }[];
}[];

export async function getCategoryTree(): Promise<CategoryTree> {
  const cats = await db.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { subcategories: { orderBy: { sortOrder: "asc" } } },
  });
  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    subs: c.subcategories.map((s) => ({ id: s.id, name: s.name, group: s.group })),
  }));
}

// Sum of actual spend/income per subcategory for a given month (YYYY-MM).
export async function getMonthlyActuals(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const txns = await db.transaction.findMany({
    where: { date: { gte: start, lt: end } },
    select: { amount: true, subcategoryId: true },
  });
  const bySub = new Map<string, number>();
  for (const t of txns) {
    if (!t.subcategoryId) continue;
    bySub.set(t.subcategoryId, (bySub.get(t.subcategoryId) ?? 0) + t.amount);
  }
  return bySub;
}

export type BudgetTxn = {
  id: string;
  date: string;
  description: string;
  amount: number;
  account: string;
  subcategoryId: string;
};

// The month's transactions grouped by subcategory — powers the per-line
// transaction drill-down on the Budget page.
export async function getMonthlyTransactionsBySub(month: string): Promise<Record<string, BudgetTxn[]>> {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const txns = await db.transaction.findMany({
    where: { date: { gte: start, lt: end } },
    select: {
      id: true,
      date: true,
      description: true,
      amount: true,
      subcategoryId: true,
      account: { select: { name: true } },
    },
    orderBy: { date: "desc" },
  });
  const bySub: Record<string, BudgetTxn[]> = {};
  for (const t of txns) {
    if (!t.subcategoryId) continue;
    (bySub[t.subcategoryId] ??= []).push({
      id: t.id,
      date: t.date.toISOString().slice(0, 10),
      description: t.description,
      amount: t.amount,
      account: t.account.name,
      subcategoryId: t.subcategoryId,
    });
  }
  return bySub;
}

// Spend (expenses only, as positive magnitudes) grouped by month for the last N months.
export async function getMonthlySpendSeries(months = 12) {
  const txns = await db.transaction.findMany({
    where: { subcategory: { category: { kind: "expense" } } },
    select: { amount: true, date: true },
  });
  const map = new Map<string, number>();
  for (const t of txns) {
    const k = monthKey(t.date);
    map.set(k, (map.get(k) ?? 0) + Math.abs(t.amount));
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-months)
    .map(([month, spend]) => ({ month, spend }));
}

export async function getMonthlyBudgetTotal(): Promise<number> {
  const lines = await db.budgetLine.findMany({
    where: { periodType: "monthly" },
    select: { projectedAmount: true },
  });
  return lines.reduce((s, l) => s + l.projectedAmount, 0);
}

// Income vs expenses for a month → savings rate.
export async function getMonthFlow(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const txns = await db.transaction.findMany({
    where: { date: { gte: start, lt: end } },
    select: { amount: true, subcategory: { select: { category: { select: { kind: true } } } } },
  });
  let income = 0;
  let expense = 0;
  for (const t of txns) {
    const kind = t.subcategory?.category.kind;
    if (kind === "income" || (!kind && t.amount > 0)) income += Math.abs(t.amount);
    else if (kind === "expense" || (!kind && t.amount < 0)) expense += Math.abs(t.amount);
  }
  const savingsRate = income ? (income - expense) / income : 0;
  return { income, expense, net: income - expense, savingsRate };
}

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Earliest month with any transaction — anchors the "all time" timeframe preset.
export async function getEarliestTransactionMonth(): Promise<string | undefined> {
  const first = await db.transaction.findFirst({
    orderBy: { date: "asc" },
    select: { date: true },
  });
  return first ? monthKey(first.date) : undefined;
}

// ---------- Money-flow analysis (Budget hub) ----------
//
// A single range-scoped bundle that powers every panel on the Budget hub:
// the Sankey money map, % of spend, savings/cashflow, spend trend, the year
// grid and top movers. One transaction fetch, everything else derived in
// memory (local single-user SQLite). All `monthly` arrays are aligned to
// `months` and zero-filled, so panels never deal with gaps.

export type SubSeries = {
  id: string;
  name: string;
  group: string | null;
  monthly: number[];
  total: number;
};
export type CatSeries = {
  id: string;
  name: string;
  kind: string;
  monthly: number[];
  total: number;
  subs: SubSeries[];
};
export type MerchantSpend = { description: string; total: number; count: number };
export type LargeTxn = {
  id: string;
  date: string;
  description: string;
  amount: number;
  account: string;
  category: string | null;
};

export type FinancePeriod = {
  months: string[];
  expenseCategories: CatSeries[]; // sorted by category sortOrder
  incomeCategories: CatSeries[]; // income sources, sorted by total desc
  incomeMonthly: number[];
  expenseMonthly: number[];
  netMonthly: number[]; // income − expense per month
  incomeTotal: number;
  expenseTotal: number;
  topMerchants: MerchantSpend[]; // expenses, by total desc
  largestTxns: LargeTxn[]; // expenses, by magnitude desc
};

// Mirror getMonthFlow's classification: an explicit category kind wins; with no
// category we fall back to amount sign. transfer/investment count as neither
// income nor expense (internal movements), so they're excluded from spend.
function flowKind(kind: string | undefined, amount: number): "income" | "expense" | null {
  if (kind === "income") return "income";
  if (kind === "expense") return "expense";
  if (!kind) return amount > 0 ? "income" : "expense";
  return null;
}

export async function getFinancePeriod(range: ResolvedRange): Promise<FinancePeriod> {
  const months = range.months;
  const monthIdx = new Map(months.map((m, i) => [m, i]));
  const zeros = () => new Array(months.length).fill(0);

  const txns = await db.transaction.findMany({
    where: { date: { gte: range.start, lt: range.end } },
    select: {
      id: true,
      amount: true,
      date: true,
      description: true,
      subcategoryId: true,
      subcategory: {
        select: {
          name: true,
          group: true,
          category: { select: { id: true, name: true, kind: true, sortOrder: true } },
        },
      },
      account: { select: { name: true } },
    },
    orderBy: { date: "desc" },
  });

  type CatAcc = {
    id: string;
    name: string;
    kind: string;
    sortOrder: number;
    monthly: number[];
    total: number;
    subs: Map<string, SubSeries>;
  };
  const expenseCats = new Map<string, CatAcc>();
  const incomeCats = new Map<string, CatAcc>();
  const incomeMonthly = zeros();
  const expenseMonthly = zeros();
  const merchants = new Map<string, MerchantSpend>();
  const largest: LargeTxn[] = [];

  for (const t of txns) {
    const cat = t.subcategory?.category;
    const flow = flowKind(cat?.kind, t.amount);
    if (!flow) continue;
    const mi = monthIdx.get(monthKey(t.date));
    if (mi === undefined) continue;
    const v = Math.abs(t.amount);

    if (flow === "income") incomeMonthly[mi] += v;
    else expenseMonthly[mi] += v;

    // Uncategorised transactions still count toward totals but are bucketed
    // under a synthetic "Uncategorised" group so the Sankey/grid stay complete.
    const catId = cat?.id ?? `__uncat_${flow}`;
    const catName = cat?.name ?? "Uncategorised";
    const target = flow === "income" ? incomeCats : expenseCats;
    let entry = target.get(catId);
    if (!entry) {
      entry = {
        id: catId,
        name: catName,
        kind: flow,
        sortOrder: cat?.sortOrder ?? 999,
        monthly: zeros(),
        total: 0,
        subs: new Map(),
      };
      target.set(catId, entry);
    }
    entry.monthly[mi] += v;
    entry.total += v;

    const subId = t.subcategoryId ?? `__uncat_sub_${flow}`;
    const subName = t.subcategory?.name ?? "Uncategorised";
    let sub = entry.subs.get(subId);
    if (!sub) {
      sub = { id: subId, name: subName, group: t.subcategory?.group ?? null, monthly: zeros(), total: 0 };
      entry.subs.set(subId, sub);
    }
    sub.monthly[mi] += v;
    sub.total += v;

    if (flow === "expense") {
      const key = t.description.trim() || "(no description)";
      const m = merchants.get(key) ?? { description: key, total: 0, count: 0 };
      m.total += v;
      m.count += 1;
      merchants.set(key, m);
      largest.push({
        id: t.id,
        date: t.date.toISOString().slice(0, 10),
        description: t.description,
        amount: t.amount,
        account: t.account.name,
        category: cat?.name ?? null,
      });
    }
  }

  const finishCats = (m: Map<string, CatAcc>, sortBy: "order" | "total"): CatSeries[] =>
    [...m.values()]
      .sort((a, b) => (sortBy === "order" ? a.sortOrder - b.sortOrder : b.total - a.total))
      .map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        monthly: c.monthly,
        total: c.total,
        subs: [...c.subs.values()].sort((a, b) => b.total - a.total),
      }));

  const incomeTotal = incomeMonthly.reduce((a, b) => a + b, 0);
  const expenseTotal = expenseMonthly.reduce((a, b) => a + b, 0);

  return {
    months,
    expenseCategories: finishCats(expenseCats, "order"),
    incomeCategories: finishCats(incomeCats, "total"),
    incomeMonthly,
    expenseMonthly,
    netMonthly: months.map((_, i) => incomeMonthly[i] - expenseMonthly[i]),
    incomeTotal,
    expenseTotal,
    topMerchants: [...merchants.values()].sort((a, b) => b.total - a.total).slice(0, 15),
    largestTxns: largest.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 12),
  };
}

// Average monthly income / expense / net over the trailing N months — the
// "actual" savings pace used by Project BUY.
export async function getRecentCashflow(months = 6) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const txns = await db.transaction.findMany({
    where: { date: { gte: start } },
    select: { amount: true, subcategory: { select: { category: { select: { kind: true } } } } },
  });
  let income = 0;
  let expense = 0;
  for (const t of txns) {
    const kind = t.subcategory?.category.kind;
    if (kind === "income" || (!kind && t.amount > 0)) income += Math.abs(t.amount);
    else if (kind === "expense" || (!kind && t.amount < 0)) expense += Math.abs(t.amount);
  }
  return {
    avgMonthlyIncome: income / months,
    avgMonthlyExpense: expense / months,
    avgMonthlyNet: (income - expense) / months,
  };
}

export type BuyActuals = {
  currentSaved: number;
  goalName: string | null;
  targetDate: string | null; // YYYY-MM-DD
  avgMonthlyIncome: number;
  avgMonthlyExpense: number;
  avgMonthlyNet: number;
};

// Real inputs for Project BUY: the linked house goal's balance/target plus the
// recent savings pace. The goal's currentAmount can auto-sync from net-worth buckets.
export async function getBuyActuals(): Promise<BuyActuals> {
  const goal = await db.goal.findFirst({
    where: { OR: [{ name: { contains: "property" } }, { notes: { contains: "Project BUY" } }] },
    orderBy: { sortOrder: "asc" },
  });
  const cash = await getRecentCashflow(6);
  return {
    currentSaved: goal?.currentAmount ?? 0,
    goalName: goal?.name ?? null,
    targetDate: goal?.targetDate ? goal.targetDate.toISOString().slice(0, 10) : null,
    ...cash,
  };
}

// Enumerate every "YYYY-MM" from min..max inclusive so series have no gaps.
function monthRange(min: string, max: string): string[] {
  const out: string[] = [];
  let [y, m] = min.split("-").map(Number);
  const [ey, em] = max.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export type TrendSeries = {
  id: string;
  name: string;
  group?: string | null;
  monthly: number[]; // aligned to months[]
  yearly: number[]; // aligned to years[]
};
export type CategoryTrend = TrendSeries & { subs: TrendSeries[] };
export type SpendMatrix = {
  months: string[]; // ordered "YYYY-MM"
  years: string[]; // ordered "YYYY"
  categories: CategoryTrend[];
};

// Spend per expense category & subcategory bucketed by month and year, with
// zero-filled continuous series — feeds the Trends page sparklines and charts.
export async function getCategorySpendMatrix(): Promise<SpendMatrix> {
  const txns = await db.transaction.findMany({
    where: { subcategory: { category: { kind: "expense" } } },
    select: {
      amount: true,
      date: true,
      subcategoryId: true,
      subcategory: {
        select: {
          name: true,
          group: true,
          category: { select: { id: true, name: true, sortOrder: true } },
        },
      },
    },
  });

  if (txns.length === 0) return { months: [], years: [], categories: [] };

  const keys = txns.map((t) => monthKey(t.date));
  const months = monthRange(keys.reduce((a, b) => (a < b ? a : b)), keys.reduce((a, b) => (a > b ? a : b)));
  const monthIdx = new Map(months.map((m, i) => [m, i]));
  const years = [...new Set(months.map((m) => m.slice(0, 4)))].sort();
  const yearIdx = new Map(years.map((y, i) => [y, i]));

  type Bucket = { name: string; group: string | null; monthly: number[]; yearly: number[] };
  const makeBucket = (name: string, group: string | null = null): Bucket => ({
    name,
    group,
    monthly: new Array(months.length).fill(0),
    yearly: new Array(years.length).fill(0),
  });

  const cats = new Map<
    string,
    { name: string; sortOrder: number; total: Bucket; subs: Map<string, Bucket> }
  >();

  for (const t of txns) {
    const sub = t.subcategory;
    if (!sub || !t.subcategoryId) continue;
    const cat = sub.category;
    const mi = monthIdx.get(monthKey(t.date))!;
    const yi = yearIdx.get(monthKey(t.date).slice(0, 4))!;
    const v = Math.abs(t.amount);

    let entry = cats.get(cat.id);
    if (!entry) {
      entry = { name: cat.name, sortOrder: cat.sortOrder, total: makeBucket(cat.name), subs: new Map() };
      cats.set(cat.id, entry);
    }
    entry.total.monthly[mi] += v;
    entry.total.yearly[yi] += v;

    let sb = entry.subs.get(t.subcategoryId);
    if (!sb) {
      sb = makeBucket(sub.name, sub.group);
      entry.subs.set(t.subcategoryId, sb);
    }
    sb.monthly[mi] += v;
    sb.yearly[yi] += v;
  }

  const categories: CategoryTrend[] = [...cats.entries()]
    .sort((a, b) => a[1].sortOrder - b[1].sortOrder)
    .map(([id, c]) => ({
      id,
      name: c.name,
      monthly: c.total.monthly,
      yearly: c.total.yearly,
      subs: [...c.subs.entries()]
        .map(([sid, s]) => ({ id: sid, name: s.name, group: s.group, monthly: s.monthly, yearly: s.yearly }))
        .sort((a, b) => b.monthly.reduce((x, y) => x + y, 0) - a.monthly.reduce((x, y) => x + y, 0)),
    }));

  return { months, years, categories };
}
