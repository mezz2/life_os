import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { TAXONOMY, RULES } from "../src/lib/taxonomy";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const db = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Example seed data. None of this is real — it just gives a fresh clone a
// working demo (net worth, goals, budget, categories) on first run. Replace it
// with your own, or run with an empty DB and add everything through the UI.
// ---------------------------------------------------------------------------

// Taxonomy + starter rules live in src/lib/taxonomy.ts (shared with the
// POST /api/taxonomy route so a blank DB can install them from the UI).

// ---------- Net worth snapshots (example data) ----------
const BUCKETS = [
  "Emergency Fund",
  "Savings",
  "US Equities",
  "AUS Equities",
  "Global Equities",
  "Crypto",
  "Super",
] as const;

// [date dd/mm/yyyy, EmergencyFund, Savings, US, AUS, Global, Crypto, Super]
const NET_WORTH: [string, number, number, number, number, number, number, number][] = [
  ["01/01/2025", 5000, 8000, 12000, 6000, 0, 1000, 10000],
  ["01/04/2025", 5500, 9000, 13500, 6500, 500, 1100, 11000],
  ["01/07/2025", 6000, 10000, 15000, 7000, 800, 1200, 12000],
  ["01/10/2025", 6500, 9500, 16500, 7500, 1000, 1300, 13000],
  ["01/01/2026", 7000, 11000, 18000, 8000, 1200, 1400, 14000],
];

function parseDMY(s: string): Date {
  const [d, m, y] = s.split("/").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// UTC midnight `n` days before today — used to backdate example habit logs.
function dayAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

// ---------- Goals (example data) ----------
const GOALS: {
  name: string;
  term: string;
  targetAmount?: number;
  currentAmount: number;
  linkedBucket?: string;
  targetDate?: string;
  notes?: string;
  sortOrder: number;
}[] = [
  {
    name: "3 Month Emergency Fund",
    term: "short",
    targetAmount: 9000,
    currentAmount: 7000,
    linkedBucket: "Emergency Fund",
    targetDate: "31/12/2026",
    sortOrder: 1,
  },
  {
    name: "Invest $10,000 in the stock market",
    term: "short",
    targetAmount: 10000,
    currentAmount: 3000,
    targetDate: "31/12/2026",
    sortOrder: 2,
  },
  {
    name: "Stock portfolio at $100k",
    term: "short",
    targetAmount: 100000,
    currentAmount: 27200,
    notes: "US + AUS + Global equities combined.",
    targetDate: "31/12/2027",
    sortOrder: 3,
  },
  {
    name: "First property deposit",
    term: "long",
    targetAmount: 120000,
    currentAmount: 0,
    notes: "10% deposit + government fees (Project BUY).",
    sortOrder: 4,
  },
];

// ---------- Monthly budget lines (example data) ----------
const BUDGET: { sub: string; monthly: number }[] = [
  { sub: "Rent / Board", monthly: 650 },
  { sub: "Groceries", monthly: 400 },
  { sub: "Vehicle Insurance", monthly: 130 },
  { sub: "Vehicle Registration", monthly: 50 },
  { sub: "Medical", monthly: 140 },
];

async function main() {
  console.log("Seeding LifeOS finances…");

  // Wipe (idempotent reseed of reference data; keeps it simple for dev)
  await db.netWorthEntry.deleteMany();
  await db.netWorthSnapshot.deleteMany();
  await db.budgetLine.deleteMany();
  await db.categoryRule.deleteMany();
  await db.habitLog.deleteMany();
  await db.habit.deleteMany();
  await db.goal.deleteMany();
  await db.subcategory.deleteMany();
  await db.category.deleteMany();

  // Taxonomy
  const subId = new Map<string, string>();
  for (let c = 0; c < TAXONOMY.length; c++) {
    const t = TAXONOMY[c];
    const cat = await db.category.upsert({
      where: { name: t.category },
      create: { name: t.category, kind: t.kind, sortOrder: c },
      update: { kind: t.kind, sortOrder: c },
    });
    for (let i = 0; i < t.subs.length; i++) {
      const s = t.subs[i];
      const sub = await db.subcategory.create({
        data: { name: s.name, group: s.group ?? null, categoryId: cat.id, sortOrder: i },
      });
      subId.set(s.name, sub.id);
    }
  }
  console.log(`  ✓ taxonomy: ${subId.size} subcategories`);

  // Accounts
  const accounts = [
    { name: "Everyday", institution: "CBA", type: "transaction" },
    { name: "Credit Card", institution: "CBA", type: "credit" },
    { name: "Savings", institution: "Westpac", type: "savings" },
    { name: "Second Everyday", institution: "UBank", type: "transaction" },
    { name: "Travel", institution: "Wise", type: "transaction" },
    { name: "Manual", institution: "Manual", type: "transaction" },
  ];
  for (const a of accounts) {
    const exists = await db.account.findFirst({ where: { name: a.name } });
    if (!exists) await db.account.create({ data: a });
  }
  console.log(`  ✓ accounts: ${accounts.length}`);

  // Net worth
  for (const row of NET_WORTH) {
    const [dateStr, ...vals] = row;
    const snap = await db.netWorthSnapshot.create({
      data: { date: parseDMY(dateStr as string) },
    });
    await db.netWorthEntry.createMany({
      data: BUCKETS.map((b, i) => ({
        snapshotId: snap.id,
        bucket: b,
        amount: vals[i] as number,
      })),
    });
  }
  console.log(`  ✓ net worth: ${NET_WORTH.length} snapshots`);

  // Goals
  for (const g of GOALS) {
    await db.goal.create({
      data: {
        name: g.name,
        term: g.term,
        targetAmount: g.targetAmount ?? null,
        currentAmount: g.currentAmount,
        linkedBucket: g.linkedBucket ?? null,
        targetDate: g.targetDate ? parseDMY(g.targetDate) : null,
        notes: g.notes ?? null,
        sortOrder: g.sortOrder,
      },
    });
  }
  console.log(`  ✓ goals: ${GOALS.length}`);

  // Budget lines
  for (const b of BUDGET) {
    const id = subId.get(b.sub);
    if (!id) continue;
    await db.budgetLine.create({
      data: { subcategoryId: id, periodType: "monthly", projectedAmount: b.monthly },
    });
  }
  console.log(`  ✓ budget lines: ${BUDGET.length}`);

  // Rules
  for (const r of RULES) {
    const id = subId.get(r.sub);
    if (!id) continue;
    await db.categoryRule.create({
      data: {
        pattern: r.pattern,
        matchType: "contains",
        subcategoryId: id,
        priority: r.priority ?? 100,
        source: "seed",
      },
    });
  }
  console.log(`  ✓ rules: ${RULES.length}`);

  // ---------- Habits (example data) ----------
  // "Read" — daily, a long live streak; today is left unlogged so you can tap it.
  const read = await db.habit.create({
    data: {
      createdAt: dayAgo(45),
      name: "Read 10 pages",
      identityStatement: "I am a reader",
      type: "build",
      cadence: "daily",
      twoMinVersion: "Read one page",
      sortOrder: 1,
    },
  });
  await db.habitLog.createMany({
    data: Array.from({ length: 23 }, (_, k) => ({ habitId: read.id, date: dayAgo(k + 1), status: "done" })),
  });

  // "Journal" — daily, but the last two days were missed → "never miss twice".
  const journal = await db.habit.create({
    data: { createdAt: dayAgo(45), name: "Journal", identityStatement: "I reflect daily", type: "build", cadence: "daily", sortOrder: 2 },
  });
  await db.habitLog.createMany({
    data: Array.from({ length: 20 }, (_, k) => ({ habitId: journal.id, date: dayAgo(k + 3), status: "done" })),
  });

  // "Meditate" — weekdays only (Mon–Fri).
  const meditate = await db.habit.create({
    data: {
      createdAt: dayAgo(45),
      name: "Meditate",
      identityStatement: "I am calm and focused",
      type: "build",
      cadence: "weekdays",
      weekdays: "1,2,3,4,5",
      twoMinVersion: "Three deep breaths",
      sortOrder: 3,
    },
  });
  await db.habitLog.createMany({
    data: Array.from({ length: 30 }, (_, k) => dayAgo(k + 1))
      .filter((d) => d.getUTCDay() >= 1 && d.getUTCDay() <= 5)
      .map((date) => ({ habitId: meditate.id, date, status: "done" })),
  });

  // "Gym" — 3× per week.
  const gym = await db.habit.create({
    data: { createdAt: dayAgo(45), name: "Gym", identityStatement: "I am an athlete", type: "build", cadence: "weekly_count", targetCount: 3, sortOrder: 4 },
  });
  await db.habitLog.createMany({
    data: [1, 3, 5, 8, 10, 12, 15, 17, 19, 22, 24, 26].map((k) => ({ habitId: gym.id, date: dayAgo(k), status: "done" })),
  });

  // "No late-night snacking" — a break habit.
  const snack = await db.habit.create({
    data: { createdAt: dayAgo(45), name: "No late-night snacking", identityStatement: "I fuel my body well", type: "break", cadence: "daily", sortOrder: 5 },
  });
  await db.habitLog.createMany({
    data: Array.from({ length: 9 }, (_, k) => ({ habitId: snack.id, date: dayAgo(k + 1), status: "done" })),
  });

  console.log("  ✓ habits: 5 with example logs");

  console.log("Done.");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
