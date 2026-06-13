// The standard LifeOS category taxonomy + starter categorisation rules.
// This is *structural* data everyone needs (unlike the example net-worth /
// goals / budget amounts in prisma/seed.ts). It's imported both by the seed
// and by POST /api/taxonomy, so a blank-slate DB can install it from the UI.

export type TaxonomySub = { name: string; group?: string };

export const TAXONOMY: { category: string; kind: string; subs: TaxonomySub[] }[] = [
  {
    category: "Income",
    kind: "income",
    subs: [
      { name: "Salary" },
      { name: "Side Income" },
      { name: "Interest" },
      { name: "Tax Refund" },
    ],
  },
  {
    category: "Needs",
    kind: "expense",
    subs: [
      { name: "Rent / Board", group: "Survival" },
      { name: "Groceries", group: "Survival" },
      { name: "Personal Supplies", group: "Survival" },
      { name: "Pet Insurance", group: "Pet" },
      { name: "Pet Food", group: "Pet" },
      { name: "Pet Medical", group: "Pet" },
      { name: "Petrol", group: "Transport" },
      { name: "Public Transport", group: "Transport" },
      { name: "Vehicle Registration", group: "Transport" },
      { name: "Vehicle Insurance", group: "Transport" },
      { name: "Vehicle Maintenance", group: "Transport" },
      { name: "Tolls and Parking", group: "Transport" },
      { name: "Gym", group: "Health" },
      { name: "Medical", group: "Health" },
      { name: "Haircut", group: "Health" },
    ],
  },
  {
    category: "Wants",
    kind: "expense",
    subs: [
      { name: "Streaming", group: "Subscriptions" },
      { name: "Cloud Storage", group: "Subscriptions" },
      { name: "Software", group: "Subscriptions" },
      { name: "Sport / Hobby", group: "Lifestyle" },
      { name: "Events & Activities", group: "Lifestyle" },
      { name: "Eating Out", group: "Eating Out" },
      { name: "Takeaway & Delivery", group: "Eating Out" },
      { name: "Going Out", group: "Going Out" },
      { name: "Dates", group: "Dates" },
      { name: "Flights", group: "Travel" },
      { name: "Accommodation", group: "Travel" },
      { name: "Travel Food", group: "Travel" },
      { name: "Gifts", group: "Shopping" },
      { name: "Personal", group: "Shopping" },
    ],
  },
  {
    category: "Investment",
    kind: "investment",
    subs: [
      { name: "Stocks" },
      { name: "Super Contribution" },
      { name: "Crypto" },
      { name: "Emergency Fund" },
      { name: "House Fund" },
    ],
  },
  {
    category: "Transfer",
    kind: "transfer",
    subs: [{ name: "Internal Transfer" }, { name: "Savings" }],
  },
  { category: "Misc", kind: "expense", subs: [{ name: "Uncategorised" }] },
];

// Starter categorisation rules (common AU merchants).
export const RULES: { pattern: string; sub: string; priority?: number }[] = [
  { pattern: "woolworths", sub: "Groceries" },
  { pattern: "coles", sub: "Groceries" },
  { pattern: "aldi", sub: "Groceries" },
  { pattern: "iga", sub: "Groceries" },
  { pattern: "costco", sub: "Groceries" },
  { pattern: "bp ", sub: "Petrol" },
  { pattern: "shell", sub: "Petrol" },
  { pattern: "ampol", sub: "Petrol" },
  { pattern: "caltex", sub: "Petrol" },
  { pattern: "7-eleven", sub: "Petrol" },
  { pattern: "united petroleum", sub: "Petrol" },
  { pattern: "opal", sub: "Public Transport" },
  { pattern: "transport for nsw", sub: "Public Transport" },
  { pattern: "transportfornsw", sub: "Public Transport" },
  { pattern: "linkt", sub: "Tolls and Parking" },
  { pattern: "e-toll", sub: "Tolls and Parking" },
  { pattern: "parking", sub: "Tolls and Parking" },
  { pattern: "mcdonald", sub: "Takeaway & Delivery" },
  { pattern: "kfc", sub: "Takeaway & Delivery" },
  { pattern: "hungry jack", sub: "Takeaway & Delivery" },
  { pattern: "guzman", sub: "Takeaway & Delivery" },
  { pattern: "domino", sub: "Takeaway & Delivery" },
  { pattern: "uber eats", sub: "Takeaway & Delivery", priority: 50 },
  { pattern: "ubereats", sub: "Takeaway & Delivery", priority: 50 },
  { pattern: "doordash", sub: "Takeaway & Delivery" },
  { pattern: "menulog", sub: "Takeaway & Delivery" },
  { pattern: "anytime fitness", sub: "Gym" },
  { pattern: "fitness first", sub: "Gym" },
  { pattern: "apple.com/bill", sub: "Cloud Storage" },
  { pattern: "icloud", sub: "Cloud Storage" },
  { pattern: "netflix", sub: "Streaming" },
  { pattern: "spotify", sub: "Streaming" },
  { pattern: "xbox", sub: "Streaming" },
  { pattern: "chemist warehouse", sub: "Personal Supplies" },
  { pattern: "priceline", sub: "Personal Supplies" },
  { pattern: "pharmacy", sub: "Medical" },
  { pattern: "anthropic", sub: "Software" },
  { pattern: "openai", sub: "Software" },
  { pattern: "google one", sub: "Software" },
  // Internal transfers (priority 40-45 so they win over merchant guesses).
  // These keep money moved between your own accounts out of the income/expense
  // totals — otherwise a $500 move shows as both +$500 in and -$500 out.
  { pattern: "transfer to xx", sub: "Internal Transfer", priority: 40 },
  { pattern: "transfer from xx", sub: "Internal Transfer", priority: 40 },
  { pattern: "internal transfer", sub: "Internal Transfer", priority: 40 },
  { pattern: "payment received", sub: "Internal Transfer", priority: 40 },
  { pattern: "tfr", sub: "Internal Transfer", priority: 45 }, // Westpac mobile/online transfers
  { pattern: "transfer to ", sub: "Internal Transfer", priority: 46 },
  { pattern: "transfer from ", sub: "Internal Transfer", priority: 46 },
  { pattern: "directcredit", sub: "Internal Transfer", priority: 60 },
  { pattern: "salary", sub: "Salary", priority: 40 },
  { pattern: "klook", sub: "Events & Activities", priority: 60 },
];

// Minimal structural type so this works for both the Prisma client used by
// the seed (tsx) and the app's db (@/lib/db) without importing generated types.
type TaxonomyDB = {
  category: {
    count: () => Promise<number>;
    create: (a: { data: { name: string; kind: string; sortOrder: number } }) => Promise<{ id: string }>;
  };
  subcategory: {
    create: (a: {
      data: { name: string; group: string | null; categoryId: string; sortOrder: number };
    }) => Promise<{ id: string }>;
  };
  categoryRule: {
    create: (a: {
      data: { pattern: string; matchType: string; subcategoryId: string; priority: number; source: string };
    }) => Promise<unknown>;
  };
};

// Install the standard taxonomy + starter rules. Idempotent: a no-op if any
// categories already exist, so it can never clobber a populated DB.
export async function installStandardTaxonomy(db: TaxonomyDB) {
  const existing = await db.category.count();
  if (existing > 0) {
    return { created: false, categories: 0, subcategories: 0, rules: 0 };
  }

  const subId = new Map<string, string>();
  for (let c = 0; c < TAXONOMY.length; c++) {
    const t = TAXONOMY[c];
    const cat = await db.category.create({ data: { name: t.category, kind: t.kind, sortOrder: c } });
    for (let i = 0; i < t.subs.length; i++) {
      const s = t.subs[i];
      const sub = await db.subcategory.create({
        data: { name: s.name, group: s.group ?? null, categoryId: cat.id, sortOrder: i },
      });
      subId.set(s.name, sub.id);
    }
  }

  let ruleCount = 0;
  for (const r of RULES) {
    const id = subId.get(r.sub);
    if (!id) continue;
    await db.categoryRule.create({
      data: { pattern: r.pattern, matchType: "contains", subcategoryId: id, priority: r.priority ?? 100, source: "seed" },
    });
    ruleCount++;
  }

  return { created: true, categories: TAXONOMY.length, subcategories: subId.size, rules: ruleCount };
}
