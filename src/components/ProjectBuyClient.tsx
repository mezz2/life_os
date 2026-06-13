"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Card, Stat, Badge } from "@/components/ui";
import { useChartInk } from "@/components/Theme";
import { aud, pct, compact, fmtDate } from "@/lib/format";
import { projectBuy, monthlyRepayment, amortize, BUY_DEFAULTS, BUY_KEY, type BuyInput, type BuyResult, type AmortResult } from "@/lib/buy";
import type { BuyActuals } from "@/lib/queries";

const WEEK_MS = 7 * 24 * 3600 * 1000;

export function ProjectBuyClient({ actuals }: { actuals: BuyActuals }) {
  const [input, setInput] = useState<BuyInput>(BUY_DEFAULTS);
  const ink = useChartInk();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(BUY_KEY);
      if (saved) setInput({ ...BUY_DEFAULTS, ...JSON.parse(saved) });
    } catch {}
  }, []);

  const set = <K extends keyof BuyInput>(k: K, v: BuyInput[K]) =>
    setInput((prev) => {
      const next = { ...prev, [k]: v };
      try {
        localStorage.setItem(BUY_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

  // One-click pull-through of real annual figures from the budget / cash flow.
  const pullFromBudget = () =>
    setInput((prev) => {
      const next: BuyInput = {
        ...prev,
        grossIncomeA: Math.round(actuals.avgMonthlyIncome * 12),
        livingExpenses: Math.round(actuals.avgMonthlyExpense * 12),
      };
      try {
        localStorage.setItem(BUY_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

  const r = useMemo(() => projectBuy(input), [input]);
  const depositScenarios = useMemo(
    () => [0.05, 0.1, 0.15, 0.2].map((d) => ({ d, r: projectBuy({ ...input, depositPct: d }) })),
    [input],
  );

  // ---- progress vs reality ----
  const now = new Date();
  const target = r.perPersonUpfront; // your share — drives required pace & the chart
  const totalTarget = r.upfront; // whole purchase (both people, when couple)
  const saved = actuals.currentSaved;
  const gap = Math.max(0, target - saved); // gap to your share
  const gapToTotal = Math.max(0, totalTarget - saved); // gap to the full purchase
  const progress = totalTarget > 0 ? Math.min(1, saved / totalTarget) : 0; // bar fills against total
  const shareFrac = totalTarget > 0 ? Math.min(1, target / totalTarget) : 1; // midpoint marker
  const fundedShare = saved >= target;

  const targetDate = actuals.targetDate ? new Date(actuals.targetDate) : new Date(now.getTime() + input.years * 52 * WEEK_MS);
  const remainingWeeks = Math.max(1, (targetDate.getTime() - now.getTime()) / WEEK_MS);
  const requiredWeekly = gap / remainingWeeks;

  const actualWeekly = (actuals.avgMonthlyNet * 12) / 52;
  const onTrack = actualWeekly >= requiredWeekly && gap > 0;
  const weeksToGoal = actualWeekly > 0 ? gap / actualWeekly : Infinity;
  const projectedDate = isFinite(weeksToGoal) ? new Date(now.getTime() + weeksToGoal * WEEK_MS) : null;

  const actualAnnualIncome = actuals.avgMonthlyIncome * 12;
  const incomeShortfall = r.preTaxIncome - actualAnnualIncome;

  // ---- projection chart: cumulative savings at current pace vs target ----
  const chart = useMemo(() => {
    const months = Math.min(180, Math.max(input.years * 12 + 6, isFinite(weeksToGoal) ? Math.ceil(weeksToGoal / 4.33) + 3 : input.years * 12));
    const monthlyNet = actuals.avgMonthlyNet;
    const data: { m: string; saved: number; target: number }[] = [];
    for (let i = 0; i <= months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      data.push({
        m: d.toLocaleString("en-AU", { month: "short", year: "2-digit" }),
        saved: Math.round(saved + monthlyNet * i),
        target,
      });
    }
    return data;
  }, [input.years, actuals.avgMonthlyNet, saved, target, weeksToGoal, now]);

  return (
    <div className="space-y-6 stagger">
      {/* Assumptions */}
      <Card>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="font-semibold">Assumptions</div>
          <div className="flex items-center gap-2">
            <Seg value={input.couple ? "couple" : "solo"} options={[["solo", "Solo"], ["couple", "Couple"]]} onChange={(v) => set("couple", v === "couple")} />
            <Toggle on={input.firstHomeBuyer} label="First-home buyer" onChange={(v) => set("firstHomeBuyer", v)} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Property price" prefix="$">
            <Num value={input.price} onChange={(v) => set("price", v)} step={10000} />
          </Field>
          <Field label="Deposit">
            <div className="flex items-center gap-1.5">
              {[0.05, 0.1, 0.15, 0.2].map((d) => (
                <button
                  key={d}
                  onClick={() => set("depositPct", d)}
                  className="rounded-md px-2 py-1 text-xs font-medium transition-colors"
                  style={{
                    background: Math.abs(input.depositPct - d) < 1e-9 ? "var(--color-accent)" : "var(--color-surface-2)",
                    color: Math.abs(input.depositPct - d) < 1e-9 ? "var(--color-bg)" : "var(--color-muted)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  {Math.round(d * 100)}%
                </button>
              ))}
            </div>
          </Field>
          <Field label="Timeline" suffix="yrs">
            <Num value={input.years} onChange={(v) => set("years", v)} step={1} />
          </Field>
          <Field label="Mortgage rate" suffix="% p.a.">
            <Num value={input.mortgageRatePct} onChange={(v) => set("mortgageRatePct", v)} step={0.1} />
          </Field>
          <Field label="Loan term" suffix="yrs">
            <Num value={input.loanTermYears} onChange={(v) => set("loanTermYears", v)} step={1} />
          </Field>
          <Field label="Inspections / building" prefix="$">
            <Num value={input.inspections} onChange={(v) => set("inspections", v)} step={250} />
          </Field>
          <Field label="Conveyancing + bank fees" prefix="$">
            <Num value={input.otherCosts} onChange={(v) => set("otherCosts", v)} step={250} />
          </Field>
          <Field label={`Stamp duty ${input.stampDutyOverride == null ? "(auto: NSW)" : "(manual)"}`} prefix="$">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <Num value={Math.round(r.stampDuty)} onChange={(v) => set("stampDutyOverride", v)} step={500} />
              {input.stampDutyOverride != null && (
                <button onClick={() => set("stampDutyOverride", null)} className="text-xs" style={{ color: "var(--color-accent)" }}>
                  auto
                </button>
              )}
            </div>
          </Field>
        </div>
      </Card>

      {/* Headline */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Upfront cash needed" value={aud(r.upfront)} sub={input.couple ? `${aud(r.perPersonUpfront)} each` : "deposit + costs"} />
        <Stat label="Loan / LVR" value={aud(r.loan)} sub={`${pct(r.lvr, 0)} LVR`} />
        <Stat label="Est. repayment" value={`${aud(r.monthlyRepayment)}/mo`} sub={`@ ${input.mortgageRatePct}% over ${input.loanTermYears}y`} />
        <Stat
          label={input.couple ? "Save each / week" : "Save / week"}
          value={aud(r.perWeek, { cents: true })}
          sub={`${aud(r.perMonth)}/mo · ${aud(r.perYear)}/yr`}
        />
      </div>

      {/* Cost breakdown */}
      <Card>
        <div className="text-sm font-medium mb-3">Upfront cash breakdown</div>
        <Row label="Deposit" value={r.deposit} sub={`${pct(input.depositPct, 0)} of price`} />
        <Row
          label="Stamp duty"
          value={r.stampDuty}
          sub={input.firstHomeBuyer && input.stampDutyOverride == null ? "after first-home-buyer concession" : "transfer duty"}
        />
        <Row label="LMI (lenders mortgage insurance)" value={r.lmi} sub={r.lvr > 0.8 ? `est. for ${pct(r.lvr, 0)} LVR` : "none — deposit ≥ 20%"} />
        <Row label="Inspections + fees" value={r.costs} />
        <div className="flex items-center justify-between pt-3 mt-2 font-semibold" style={{ borderTop: "1px solid var(--color-border)" }}>
          <span>Total upfront</span>
          <span className="num">{aud(r.upfront)}</span>
        </div>
      </Card>

      {/* Progress vs reality */}
      <Card>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div className="text-sm font-medium">
            Your progress {actuals.goalName ? <span style={{ color: "var(--color-muted)" }}>· {actuals.goalName}</span> : null}
          </div>
          {gap > 0 ? (
            <Badge tone={onTrack ? "positive" : "warn"}>{onTrack ? "on track" : "behind pace"}</Badge>
          ) : (
            <Badge tone="positive">funded</Badge>
          )}
        </div>

        <div className="flex items-baseline justify-between mb-1.5">
          <span className="num text-lg font-semibold">{aud(saved)}</span>
          <span className="num text-sm" style={{ color: "var(--color-muted)" }}>
            of {aud(target)}{input.couple ? ` your share · ${aud(totalTarget)} total` : ""}
          </span>
        </div>
        <div className="relative">
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${progress * 100}%`, background: fundedShare || gap === 0 ? "var(--color-positive)" : onTrack ? "var(--color-accent)" : "var(--color-warn)" }}
            />
          </div>
          {input.couple && shareFrac < 0.999 && (
            <div
              className="absolute top-[-2px] bottom-[-2px]"
              style={{ left: `${shareFrac * 100}%`, width: 2, background: "var(--color-text)", transform: "translateX(-1px)" }}
            />
          )}
        </div>
        {input.couple && shareFrac < 0.999 && (
          <div className="relative h-4 mt-1">
            <span
              className="num absolute text-[10px] whitespace-nowrap"
              style={{ left: `${shareFrac * 100}%`, transform: "translateX(-50%)", color: fundedShare ? "var(--color-positive)" : "var(--color-muted)" }}
            >
              ↑ your share {aud(target)}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-sm">
          <Mini
            label={input.couple ? "Still needed (your share)" : "Still needed"}
            value={aud(gap)}
            sub={input.couple ? `${aud(gapToTotal)} to full price` : undefined}
          />
          <Mini label="Required / week" value={aud(requiredWeekly, { cents: true })} sub={`to ${fmtDate(targetDate.toISOString(), "month")}`} />
          <Mini label="Your actual / week" value={aud(actualWeekly, { cents: true })} tone={actualWeekly >= requiredWeekly ? "positive" : "negative"} sub="last 6 months" />
          <Mini label="On pace, bought" value={projectedDate ? fmtDate(projectedDate.toISOString(), "month") : "—"} sub={projectedDate ? `${Math.round(weeksToGoal / 52 * 10) / 10} yrs away` : "not saving yet"} />
        </div>
      </Card>

      {/* Income & savings modelling */}
      <Card>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div className="text-sm font-medium">Income & savings</div>
          <Seg
            value={input.savingsMode}
            options={[["rate", "From savings rate"], ["income", "From income & expenses"]]}
            onChange={(v) => set("savingsMode", v as BuyInput["savingsMode"])}
          />
        </div>

        {input.savingsMode === "rate" ? (
          // Backward: a chosen savings rate implies the income you'd need.
          <>
            <div className="mb-4 max-w-[16rem]">
              <Field label="Save this share of after-tax income" suffix="%">
                <Num value={Math.round(input.savingsRatePct * 100)} onChange={(v) => set("savingsRatePct", v / 100)} step={5} />
              </Field>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <Mini label={input.couple ? "Pre-tax each / yr" : "Pre-tax / yr"} value={aud(r.preTaxIncome)} sub="income needed" />
              <Mini label="After-tax / yr" value={aud(r.afterTaxIncome)} sub={`saving ${pct(input.savingsRatePct, 0)}`} />
              <Mini
                label="Your actual income / yr"
                value={actualAnnualIncome > 0 ? aud(actualAnnualIncome) : "—"}
                tone={actualAnnualIncome >= r.preTaxIncome ? "positive" : "negative"}
                sub={incomeShortfall > 0 && actualAnnualIncome > 0 ? `${aud(incomeShortfall)} short` : actualAnnualIncome > 0 ? "covers it" : "no data"}
              />
            </div>
          </>
        ) : (
          // Forward: model real income(s) and expenses → savings & timeline.
          <>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                Gross annual figures — pull your real numbers, then tweak.
              </span>
              <button
                onClick={pullFromBudget}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                style={{ background: "var(--color-accent-dim)", border: "1px solid var(--color-accent)", color: "var(--color-accent)" }}
              >
                ↻ Pull from budget
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={input.couple ? "Your gross income" : "Gross income"} prefix="$" suffix="/yr">
                <Num value={input.grossIncomeA} onChange={(v) => set("grossIncomeA", v)} step={1000} />
              </Field>
              <Field label={input.couple ? "Your living expenses" : "Living expenses"} prefix="$" suffix="/yr">
                <Num value={input.livingExpenses} onChange={(v) => set("livingExpenses", v)} step={1000} />
              </Field>
              {input.couple && (
                <>
                  <Field label="Partner gross income" prefix="$" suffix="/yr">
                    <Num value={input.grossIncomeB} onChange={(v) => set("grossIncomeB", v)} step={1000} />
                  </Field>
                  <Field label="Partner living expenses" prefix="$" suffix="/yr">
                    <Num value={input.livingExpensesB} onChange={(v) => set("livingExpensesB", v)} step={1000} />
                  </Field>
                </>
              )}
            </div>
            {input.couple ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-sm">
                <Mini
                  label="You save / yr"
                  value={aud(Math.max(0, r.yourSavings))}
                  tone={r.yourSavings > 0 ? "positive" : "negative"}
                  sub={`of ${aud(r.yourAfterTax)} after-tax`}
                />
                <Mini
                  label="Partner saves / yr"
                  value={aud(Math.max(0, r.partnerSavings))}
                  tone={r.partnerSavings > 0 ? "positive" : "negative"}
                  sub={`of ${aud(r.partnerAfterTax)} after-tax`}
                />
                <Mini label="Combined saved / yr" value={aud(r.modelledAnnualSavings)} sub={`${aud(r.modelledWeeklySavings, { cents: true })}/wk`} />
                <Mini
                  label="Deposit funded in"
                  value={isFinite(r.modelledYearsToBuy) ? `${Math.round(r.modelledYearsToBuy * 10) / 10} yrs` : "—"}
                  sub={isFinite(r.modelledYearsToBuy) ? "at this rate" : "not saving"}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-sm">
                <Mini label="After-tax / yr" value={aud(r.combinedAfterTax)} sub="after AU tax" />
                <Mini
                  label="Saved / yr"
                  value={aud(r.modelledAnnualSavings)}
                  tone={r.modelledAnnualSavings > 0 ? "positive" : "negative"}
                  sub={r.combinedAfterTax > 0 ? `${pct(r.modelledAnnualSavings / r.combinedAfterTax, 0)} of after-tax` : "set income"}
                />
                <Mini label="Saved / week" value={aud(r.modelledWeeklySavings, { cents: true })} />
                <Mini
                  label="Deposit funded in"
                  value={isFinite(r.modelledYearsToBuy) ? `${Math.round(r.modelledYearsToBuy * 10) / 10} yrs` : "—"}
                  sub={isFinite(r.modelledYearsToBuy) ? "at this rate" : "not saving"}
                />
              </div>
            )}
          </>
        )}
      </Card>

      {/* Projection */}
      <Card>
        <div className="text-sm font-medium mb-4">Savings projection at your current pace</div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={ink.grid} vertical={false} />
            <XAxis dataKey="m" tick={{ fill: ink.axis, fontSize: 11 }} minTickGap={28} />
            <YAxis tickFormatter={(v) => compact(v)} tick={{ fill: ink.axis, fontSize: 11 }} width={48} />
            <Tooltip
              contentStyle={{ background: ink.panel, border: `1px solid ${ink.border}`, borderRadius: 12, fontSize: 12 }}
              formatter={(v, n) => [aud(Number(v)), n === "saved" ? "Projected savings" : "Target"]}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="plainline" formatter={(v) => (v === "saved" ? "Projected savings" : "Target")} />
            <ReferenceLine y={target} stroke="var(--color-accent)" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="saved" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="target" stroke={ink.axis} strokeWidth={1} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Scenario compare */}
      <Card>
        <div className="text-sm font-medium mb-3">Deposit scenarios</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--color-muted)" }} className="text-left">
                <th className="py-2 pr-4 font-medium" />
                {depositScenarios.map((s) => (
                  <th key={s.d} className="py-2 px-3 font-medium text-right">{Math.round(s.d * 100)}% deposit</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <CompareRow label="Deposit" scenarios={depositScenarios} pick={(x) => x.deposit} />
              <CompareRow label="Stamp duty" scenarios={depositScenarios} pick={(x) => x.stampDuty} />
              <CompareRow label="LMI" scenarios={depositScenarios} pick={(x) => x.lmi} />
              <CompareRow label="Total upfront" scenarios={depositScenarios} pick={(x) => x.upfront} bold />
              <CompareRow label={input.couple ? "Save each / week" : "Save / week"} scenarios={depositScenarios} pick={(x) => x.perWeek} cents />
              <CompareRow label="Loan" scenarios={depositScenarios} pick={(x) => x.loan} />
              <CompareRow label="Repayment / mo" scenarios={depositScenarios} pick={(x) => x.monthlyRepayment} />
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mortgage payoff & extra repayments — remount (re-seed) when the top assumptions change */}
      <AmortizationCard
        key={`${Math.round(r.loan)}-${input.mortgageRatePct}-${input.loanTermYears}`}
        loan={r.loan}
        ratePct={input.mortgageRatePct}
        termYears={input.loanTermYears}
        ink={ink}
      />

      <p className="text-xs" style={{ color: "var(--color-muted)" }}>
        Stamp duty uses the NSW transfer-duty scale with the first-home-buyer concession; LMI, tax
        and repayments are estimates. Progress reads your linked house goal and your last 6 months of
        cash flow — link net-worth buckets to that goal to keep it current. Edit any figure above.
      </p>
    </div>
  );
}

// ---------- small building blocks ----------

function Field({ label, prefix, suffix, children, plain }: { label: string; prefix?: string; suffix?: string; children: React.ReactNode; plain?: boolean }) {
  // When the field has an input adornment we wrap everything in one bordered box
  // and let the input flex to fill it — so the box is always the full width of
  // its grid cell and rows line up regardless of how wide the suffix text is.
  const boxed = !plain && (prefix != null || suffix != null);
  const inner = (
    <>
      {prefix && <span className="text-sm shrink-0" style={{ color: "var(--color-muted)" }}>{prefix}</span>}
      {children}
      {suffix && <span className="text-sm shrink-0" style={{ color: "var(--color-muted)" }}>{suffix}</span>}
    </>
  );
  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>
        {label}
      </label>
      {boxed ? (
        <div
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
          style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
        >
          {inner}
        </div>
      ) : (
        <div className="flex items-center gap-1.5">{inner}</div>
      )}
    </div>
  );
}

function Num({ value, onChange, step = 1 }: { value: number; onChange: (v: number) => void; step?: number }) {
  // While focused we hold the raw keystrokes so the field can go empty (or to a
  // partial value like "0.") instead of snapping straight back to 0. On blur we
  // drop the draft and show the committed number again. Borderless — the parent
  // Field supplies the bordered box so all fields share one width.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (Number.isFinite(value) ? String(value) : "");
  return (
    <input
      type="number"
      inputMode="decimal"
      value={shown}
      step={step}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(e.target.value === "" ? 0 : Number(e.target.value));
      }}
      onBlur={() => setDraft(null)}
      className="num w-full min-w-0 flex-1 bg-transparent outline-none text-sm"
    />
  );
}

function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
      style={{
        background: on ? "var(--color-accent-dim)" : "var(--color-surface-2)",
        border: `1px solid ${on ? "var(--color-accent)" : "var(--color-border)"}`,
        color: on ? "var(--color-accent)" : "var(--color-muted)",
      }}
    >
      {label}
    </button>
  );
}

function Seg({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-lg p-0.5 text-xs" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className="rounded-md px-3 py-1 font-medium transition-colors"
          style={{ background: value === v ? "var(--color-accent)" : "transparent", color: value === v ? "var(--color-bg)" : "var(--color-muted)" }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Row({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span>
        {label}
        {sub && <span className="ml-2 text-xs" style={{ color: "var(--color-muted)" }}>{sub}</span>}
      </span>
      <span className="num" style={{ color: "var(--color-muted)" }}>{aud(value)}</span>
    </div>
  );
}

function Mini({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "positive" | "negative" }) {
  const color = tone === "positive" ? "var(--color-positive)" : tone === "negative" ? "var(--color-negative)" : "var(--color-text)";
  return (
    <div>
      <div className="text-xs" style={{ color: "var(--color-muted)" }}>{label}</div>
      <div className="num text-base font-semibold mt-0.5" style={{ color }}>{value}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: "var(--color-muted)" }}>{sub}</div>}
    </div>
  );
}

function CompareRow({
  label,
  scenarios,
  pick,
  bold,
  cents,
}: {
  label: string;
  scenarios: { d: number; r: BuyResult }[];
  pick: (r: BuyResult) => number;
  bold?: boolean;
  cents?: boolean;
}) {
  return (
    <tr className="border-t">
      <td className={`py-2 pr-4 ${bold ? "font-semibold" : ""}`}>{label}</td>
      {scenarios.map((s) => (
        <td key={s.d} className={`num py-2 px-3 text-right ${bold ? "font-semibold" : ""}`}>
          {aud(pick(s.r), { cents })}
        </td>
      ))}
    </tr>
  );
}

// ---------- Mortgage payoff & extra-repayment modelling ----------

function fmtDur(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m}m`;
  return `${y}y${m ? ` ${m}m` : ""}`;
}

// ---- repayment frequency helpers (model stays monthly internally) ----
type Freq = "week" | "month" | "year";
const FREQ_SFX: Record<Freq, string> = { week: "/wk", month: "/mo", year: "/yr" };
const FREQ_OPTS: [string, string][] = [["week", "Week"], ["month", "Month"], ["year", "Year"]];
function perFreq(monthly: number, f: Freq) {
  return f === "week" ? (monthly * 12) / 52 : f === "year" ? monthly * 12 : monthly;
}
function toMonthly(v: number, f: Freq) {
  return f === "week" ? (v * 52) / 12 : f === "year" ? v / 12 : v;
}
// The two frequencies you're *not* viewing, as a "$x/wk · $y/yr" breakdown.
function otherFreqs(monthly: number, f: Freq) {
  return (["week", "month", "year"] as Freq[])
    .filter((x) => x !== f)
    .map((x) => `${aud(perFreq(monthly, x), { cents: x === "week" })}${FREQ_SFX[x]}`)
    .join(" · ");
}

function AmortizationCard({
  loan,
  ratePct,
  termYears,
  ink,
}: {
  loan: number;
  ratePct: number;
  termYears: number;
  ink: ReturnType<typeof useChartInk>;
}) {
  // Seeded from the top assumptions. The parent keys this component on those
  // assumptions, so it remounts (re-seeds) whenever they change — keeping the
  // section in sync while still letting you tweak the figures locally.
  const [amt, setAmt] = useState({ loan: Math.round(loan), rate: ratePct, term: termYears, extra: 0 });
  const [freq, setFreq] = useState<Freq>("month");

  const base = monthlyRepayment(amt.loan, amt.rate, amt.term);
  const baseA = useMemo(() => amortize(amt.loan, amt.rate, base, amt.term), [amt.loan, amt.rate, amt.term, base]);
  const fastA = useMemo(() => amortize(amt.loan, amt.rate, base + amt.extra, amt.term), [amt.loan, amt.rate, amt.term, base, amt.extra]);

  const monthsSaved = Math.max(0, baseA.months - fastA.months);
  const interestSaved = Math.max(0, baseA.totalInterest - fastA.totalInterest);

  const balAt = (a: AmortResult, m: number) =>
    m <= 0 ? amt.loan : m > a.schedule.length ? 0 : a.schedule[m - 1].balance;
  const chart = useMemo(() => {
    const maxM = Math.max(baseA.months, fastA.months);
    const data: { year: number; standard: number; extra: number }[] = [];
    for (let m = 0; m <= maxM; m += 12) {
      data.push({ year: Math.round(m / 12), standard: Math.round(balAt(baseA, m)), extra: Math.round(balAt(fastA, m)) });
    }
    return data;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseA, fastA, amt.loan]);

  const baseIntPct = baseA.totalInterest + amt.loan > 0 ? baseA.totalInterest / (baseA.totalInterest + amt.loan) : 0;
  const fastIntPct = fastA.totalInterest + amt.loan > 0 ? fastA.totalInterest / (fastA.totalInterest + amt.loan) : 0;

  return (
    <Card>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div className="text-sm font-medium">Mortgage payoff &amp; extra repayments</div>
        <div className="flex items-center gap-2 flex-wrap">
          <Seg value={freq} options={FREQ_OPTS} onChange={(v) => setFreq(v as Freq)} />
          <span className="text-xs" style={{ color: "var(--color-muted)" }}>defaults from your assumptions above</span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
        <Field label="Loan amount" prefix="$">
          <Num value={amt.loan} onChange={(v) => setAmt((p) => ({ ...p, loan: v }))} step={10000} />
        </Field>
        <Field label="Mortgage rate" suffix="% p.a.">
          <Num value={amt.rate} onChange={(v) => setAmt((p) => ({ ...p, rate: v }))} step={0.1} />
        </Field>
        <Field label="Loan term" suffix="yrs">
          <Num value={amt.term} onChange={(v) => setAmt((p) => ({ ...p, term: v }))} step={1} />
        </Field>
        <Field label="Extra repayment" prefix="$" suffix={FREQ_SFX[freq]}>
          <Num
            value={Math.round(perFreq(amt.extra, freq))}
            onChange={(v) => setAmt((p) => ({ ...p, extra: toMonthly(v, freq) }))}
            step={freq === "year" ? 500 : 50}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-sm">
        <div>
          <div className="text-xs" style={{ color: "var(--color-muted)" }}>
            {amt.extra > 0 ? "Actual repayment" : "Base repayment"}
          </div>
          <div className="num text-base font-semibold mt-0.5">
            {aud(perFreq(base + amt.extra, freq), { cents: freq === "week" })}
            {FREQ_SFX[freq]}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: "var(--color-muted)" }}>
            {otherFreqs(base + amt.extra, freq)}
          </div>
          {amt.extra > 0 && (
            <div className="text-[11px] mt-0.5" style={{ color: "var(--color-muted)" }}>
              base {aud(perFreq(base, freq), { cents: freq === "week" })}
              {FREQ_SFX[freq]}
            </div>
          )}
        </div>
        <Mini
          label="Paid off in"
          value={baseA.paysOff ? fmtDur(baseA.months) : "—"}
          sub={amt.extra > 0 ? `${fmtDur(fastA.months)} with extra` : "no extra yet"}
          tone={amt.extra > 0 && monthsSaved > 0 ? "positive" : "default"}
        />
        <Mini
          label="Time saved"
          value={amt.extra > 0 ? fmtDur(monthsSaved) : "—"}
          tone={monthsSaved > 0 ? "positive" : "default"}
          sub={amt.extra > 0 ? "off the loan" : "add extra above"}
        />
        <Mini
          label="Interest saved"
          value={amt.extra > 0 ? aud(interestSaved) : "—"}
          tone={interestSaved > 0 ? "positive" : "default"}
          sub={`vs ${aud(baseA.totalInterest)} total`}
        />
      </div>

      {/* principal vs interest split over the life of the loan */}
      <div className="mt-5 space-y-2.5">
        <SplitBar label="Standard repayments" principal={amt.loan} interest={baseA.totalInterest} intPct={baseIntPct} />
        {amt.extra > 0 && (
          <SplitBar
            label={`With +${aud(perFreq(amt.extra, freq), { cents: freq === "week" })}${FREQ_SFX[freq]}`}
            principal={amt.loan}
            interest={fastA.totalInterest}
            intPct={fastIntPct}
          />
        )}
      </div>

      {/* remaining balance over time: standard vs accelerated */}
      <div className="mt-5">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={ink.grid} vertical={false} />
            <XAxis dataKey="year" tick={{ fill: ink.axis, fontSize: 11 }} tickFormatter={(v) => `${v}y`} />
            <YAxis tickFormatter={(v) => compact(v)} tick={{ fill: ink.axis, fontSize: 11 }} width={48} />
            <Tooltip
              contentStyle={{ background: ink.panel, border: `1px solid ${ink.border}`, borderRadius: 12, fontSize: 12 }}
              labelFormatter={(v) => `Year ${v}`}
              formatter={(val, n) => [aud(Number(val)), n === "standard" ? "Standard" : "With extra"]}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="plainline" formatter={(v) => (v === "standard" ? "Standard" : "With extra")} />
            <Line type="monotone" dataKey="standard" stroke={ink.axis} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="extra" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {!baseA.paysOff && amt.loan > 0 && (
        <p className="text-xs mt-2" style={{ color: "var(--color-warn)" }}>
          At this rate the repayment barely covers the interest — raise the term or repayment.
        </p>
      )}
    </Card>
  );
}

function SplitBar({ label, principal, interest, intPct }: { label: string; principal: number; interest: number; intPct: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-1">
        <span style={{ color: "var(--color-muted)" }}>{label}</span>
        <span className="num">
          <span className="font-semibold">{aud(principal + interest)}</span>
          <span style={{ color: "var(--color-muted)" }}> total cost</span>
        </span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
        <div style={{ width: `${(1 - intPct) * 100}%`, background: "var(--color-accent)" }} />
        <div style={{ width: `${intPct * 100}%`, background: "var(--color-negative)" }} />
      </div>
      <div className="flex justify-between text-[10px] mt-0.5" style={{ color: "var(--color-muted)" }}>
        <span className="num">{aud(principal)} · {pct(1 - intPct, 0)} principal</span>
        <span className="num">{aud(interest)} · {pct(intPct, 0)} interest</span>
      </div>
    </div>
  );
}
