// Project BUY — house-purchase model. Pure functions (server + client safe).
// Figures use Australian 2024–25 settings; all are overridable in the UI.

import { compact } from "./format";

// ---------- Australian resident income tax (2024–25) + Medicare levy ----------

const BRACKETS: [number, number][] = [
  // [lowerBound, marginalRate]
  [0, 0],
  [18200, 0.16],
  [45000, 0.3],
  [135000, 0.37],
  [190000, 0.45],
];

export function incomeTaxAU(taxable: number): number {
  let tax = 0;
  for (let i = 0; i < BRACKETS.length; i++) {
    const [lower, rate] = BRACKETS[i];
    const upper = i + 1 < BRACKETS.length ? BRACKETS[i + 1][0] : Infinity;
    if (taxable > lower) tax += (Math.min(taxable, upper) - lower) * rate;
  }
  return tax;
}

// Medicare levy: 2% once over the low-income threshold (simplified, ignores the taper band).
export function medicareLevy(taxable: number): number {
  return taxable > 27222 ? taxable * 0.02 : 0;
}

export function netIncome(gross: number): number {
  return gross - incomeTaxAU(gross) - medicareLevy(gross);
}

// Invert net → gross (monotonic, so binary search).
export function grossFromNet(net: number): number {
  if (net <= 0) return 0;
  let lo = net;
  let hi = net * 2.2 + 50000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (netIncome(mid) < net) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------- NSW transfer (stamp) duty, 2024 general scale ----------

export function stampDutyNSW(price: number): number {
  const scale: [number, number, number][] = [
    // [threshold, baseDutyAtThreshold, ratePer$1 above threshold]
    [0, 0, 0.0125],
    [17000, 212, 0.015],
    [37000, 512, 0.0175],
    [99000, 1597, 0.035],
    [364000, 10872, 0.045],
    [1212000, 49032, 0.055],
    [3636000, 182352, 0.07],
  ];
  let row = scale[0];
  for (const r of scale) if (price >= r[0]) row = r;
  return row[1] + (price - row[0]) * row[2];
}

// NSW First Home Buyers Assistance: full exemption to $800k, linear taper to $1M.
export function stampDutyWithFHB(price: number, firstHomeBuyer: boolean): number {
  const duty = stampDutyNSW(price);
  if (!firstHomeBuyer) return duty;
  if (price <= 800000) return 0;
  if (price >= 1000000) return duty;
  return duty * ((price - 800000) / 200000);
}

// ---------- Lenders Mortgage Insurance (rough premium by LVR) ----------

export function lmiEstimate(loan: number, lvr: number): number {
  let rate = 0;
  if (lvr > 0.95) rate = 0.046;
  else if (lvr > 0.9) rate = 0.031;
  else if (lvr > 0.85) rate = 0.013;
  else if (lvr > 0.8) rate = 0.006;
  return Math.round(loan * rate);
}

// ---------- Mortgage repayment (standard amortisation) ----------

export function monthlyRepayment(principal: number, annualRatePct: number, years: number): number {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (principal <= 0) return 0;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

// ---------- Amortisation schedule (principal vs interest, extra repayments) ----------

export type AmortMonth = { month: number; balance: number; principalPaid: number; interestPaid: number };

export type AmortResult = {
  months: number; // months to pay off (capped at term when it never amortises)
  totalInterest: number;
  totalPrincipal: number; // = original principal once paid off
  paysOff: boolean; // false when the payment doesn't even cover interest
  schedule: AmortMonth[]; // cumulative figures, one row per month
};

// Standard reducing-balance amortisation. `payment` is the total monthly outgoing
// (base repayment + any extra); the loan is paid off early when it exceeds the
// scheduled repayment.
export function amortize(principal: number, annualRatePct: number, payment: number, termYears: number): AmortResult {
  const r = annualRatePct / 100 / 12;
  const cap = Math.ceil(termYears * 12);
  const schedule: AmortMonth[] = [];
  let balance = principal;
  let interestTotal = 0;
  let principalTotal = 0;
  let month = 0;

  if (principal <= 0 || payment <= 0) {
    return { months: 0, totalInterest: 0, totalPrincipal: 0, paysOff: principal <= 0, schedule };
  }

  // Hard ceiling well past the term so an under-funded payment still terminates.
  const limit = cap + 1200;
  while (balance > 0.005 && month < limit) {
    month++;
    const interest = balance * r;
    let principalPart = payment - interest;
    if (principalPart <= 0) {
      // Payment never reduces the balance — not amortising.
      return { months: cap, totalInterest: interest * cap, totalPrincipal: 0, paysOff: false, schedule };
    }
    if (principalPart > balance) principalPart = balance;
    balance -= principalPart;
    interestTotal += interest;
    principalTotal += principalPart;
    schedule.push({ month, balance, principalPaid: principalTotal, interestPaid: interestTotal });
  }
  return { months: month, totalInterest: interestTotal, totalPrincipal: principalTotal, paysOff: balance <= 0.005, schedule };
}

// ---------- The model ----------

export type BuyInput = {
  price: number;
  depositPct: number; // 0.10
  years: number;
  savingsRatePct: number; // 0.50 of after-tax income
  couple: boolean;
  firstHomeBuyer: boolean;
  mortgageRatePct: number; // e.g. 6.0
  loanTermYears: number; // e.g. 30
  inspections: number;
  otherCosts: number; // conveyancing, bank/legal fees
  stampDutyOverride: number | null;
  // ---- savings modelling ----
  // "rate":   set a savings rate, derive the income needed (backward).
  // "income": set income(s) + living expenses, derive savings & timeline (forward).
  savingsMode: "rate" | "income";
  grossIncomeA: number; // your gross annual income
  grossIncomeB: number; // partner gross annual income (couple only)
  livingExpenses: number; // your living expenses, annual
  livingExpensesB: number; // partner living expenses, annual (couple only)
};

export type BuyResult = {
  deposit: number;
  stampDuty: number;
  lmi: number;
  costs: number; // inspections + other
  upfront: number; // total cash needed at settlement
  loan: number;
  lvr: number;
  monthlyRepayment: number;
  // savings target & pace, per person (split when couple)
  perPersonUpfront: number;
  perYear: number;
  perMonth: number;
  perWeek: number;
  // income required to fund the pace at the chosen savings rate (per person, annual)
  afterTaxIncome: number;
  preTaxIncome: number;
  // ---- forward model (savingsMode === "income") ----
  combinedAfterTax: number; // household after-tax income, annual
  modelledAnnualSavings: number; // after-tax income − living expenses
  modelledWeeklySavings: number;
  modelledYearsToBuy: number; // upfront ÷ annual savings (Infinity if not saving)
  // per-person split of the forward model (couple only; partner = 0 when solo)
  yourAfterTax: number;
  yourSavings: number;
  partnerAfterTax: number;
  partnerSavings: number;
};

export function projectBuy(input: BuyInput): BuyResult {
  const deposit = input.price * input.depositPct;
  const loan = Math.max(0, input.price - deposit);
  const lvr = input.price > 0 ? loan / input.price : 0;
  const stampDuty =
    input.stampDutyOverride != null
      ? input.stampDutyOverride
      : stampDutyWithFHB(input.price, input.firstHomeBuyer);
  const lmi = lmiEstimate(loan, lvr);
  const costs = input.inspections + input.otherCosts;
  const upfront = deposit + stampDuty + lmi + costs;

  const people = input.couple ? 2 : 1;
  const perPersonUpfront = upfront / people;
  const perYear = input.years > 0 ? perPersonUpfront / input.years : perPersonUpfront;
  const perMonth = perYear / 12;
  const perWeek = perYear / 52;

  const rate = input.savingsRatePct > 0 ? input.savingsRatePct : 1;
  const afterTaxIncome = perYear / rate;
  const preTaxIncome = grossFromNet(afterTaxIncome);

  // Forward model: model each person's after-tax income and living expenses, then
  // pool the savings. Solo collapses to just "your" figures.
  const yourAfterTax = netIncome(input.grossIncomeA);
  const yourSavings = yourAfterTax - input.livingExpenses;
  const partnerAfterTax = input.couple ? netIncome(input.grossIncomeB) : 0;
  const partnerSavings = input.couple ? partnerAfterTax - input.livingExpensesB : 0;
  const combinedAfterTax = yourAfterTax + partnerAfterTax;
  const modelledAnnualSavings = Math.max(0, yourSavings + partnerSavings);
  const modelledWeeklySavings = modelledAnnualSavings / 52;
  const modelledYearsToBuy = modelledAnnualSavings > 0 ? upfront / modelledAnnualSavings : Infinity;

  return {
    deposit,
    stampDuty,
    lmi,
    costs,
    upfront,
    loan,
    lvr,
    monthlyRepayment: monthlyRepayment(loan, input.mortgageRatePct, input.loanTermYears),
    perPersonUpfront,
    perYear,
    perMonth,
    perWeek,
    afterTaxIncome,
    preTaxIncome,
    combinedAfterTax,
    modelledAnnualSavings,
    modelledWeeklySavings,
    modelledYearsToBuy,
    yourAfterTax,
    yourSavings,
    partnerAfterTax,
    partnerSavings,
  };
}

// ---------- Shared store + presentation (used by Project BUY and Goals) ----------

export const BUY_KEY = "projectBuyInput";

export const BUY_DEFAULTS: BuyInput = {
  price: 750000,
  depositPct: 0.1,
  years: 4,
  savingsRatePct: 0.5,
  couple: false,
  firstHomeBuyer: true,
  mortgageRatePct: 6.0,
  loanTermYears: 30,
  inspections: 1500,
  otherCosts: 2000,
  stampDutyOverride: null,
  savingsMode: "rate",
  grossIncomeA: 0,
  grossIncomeB: 0,
  livingExpenses: 0,
  livingExpensesB: 0,
};

// Read the saved calculator settings from localStorage. Safe to call anywhere —
// returns defaults when run on the server or when nothing is saved yet.
export function readBuyInput(): BuyInput {
  if (typeof window === "undefined") return BUY_DEFAULTS;
  try {
    const saved = window.localStorage.getItem(BUY_KEY);
    if (saved) return { ...BUY_DEFAULTS, ...JSON.parse(saved) };
  } catch {}
  return BUY_DEFAULTS;
}

// Is this goal the house-purchase goal Project BUY models? Mirrors getBuyActuals.
export function isHouseGoal(g: { name: string; notes?: string | null }): boolean {
  return /property/i.test(g.name) || (g.notes ?? "").includes("Project BUY");
}

// Dynamic one-line description of the modelled purchase, for the goal subtitle.
export function buySummary(input: BuyInput): string {
  const who = input.couple ? "Couple" : "Solo";
  const dep = Math.round(input.depositPct * 100);
  const fhb = input.firstHomeBuyer ? " · first-home buyer" : "";
  return `${who} · ${dep}% deposit on $${compact(input.price)} property${fhb} · incl. stamp duty + fees`;
}
