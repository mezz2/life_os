import Link from "next/link";
import { Card, Badge } from "@/components/ui";
import { Sparkline } from "@/components/Sparkline";
import { InsightCard } from "@/components/InsightCard";
import { TodayStrip } from "@/components/TodayStrip";
import { GettingStarted, type SetupProgress } from "@/components/GettingStarted";
import { db } from "@/lib/db";
import { getNeedsAttention } from "@/lib/insights/store";
import { insightHref } from "@/lib/insights/placement";
import {
  getLatestNetWorth,
  getNetWorthSeries,
  getMonthFlow,
  getMonthlyBudgetTotal,
  getMonthlyActuals,
  currentMonthKey,
} from "@/lib/queries";
import { aud, pct, fmtDate, monthLabel } from "@/lib/format";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const month = currentMonthKey();
  const [nw, series, flow, budgetTotal, actuals, goals, attention, recent, setup] = await Promise.all([
    getLatestNetWorth(),
    getNetWorthSeries(),
    getMonthFlow(month),
    getMonthlyBudgetTotal(),
    getMonthlyActuals(month),
    db.goal.findMany({ where: { term: "short" }, orderBy: { sortOrder: "asc" }, take: 4 }),
    getNeedsAttention(3),
    db.transaction.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 6,
      include: { subcategory: { select: { name: true } }, account: { select: { name: true } } },
    }),
    getSetupProgress(),
  ]);

  const actualSpend = [...actuals.entries()].reduce((s, [, v]) => s + (v < 0 ? Math.abs(v) : 0), 0);

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  })();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting}
          {process.env.NEXT_PUBLIC_USER_NAME ? `, ${process.env.NEXT_PUBLIC_USER_NAME}` : ""}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
          Your life at a glance — {monthLabel(month)}.
        </p>
      </div>

      <GettingStarted progress={setup} />

      <TodayStrip />

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        {/* Net worth hero */}
        <Card className="lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
                Net worth
              </div>
              <div className="num text-4xl font-semibold mt-1">{nw ? aud(nw.latest.total) : "—"}</div>
              {nw && (
                <div
                  className="flex items-center gap-1 text-sm mt-1"
                  style={{ color: nw.change >= 0 ? "var(--color-positive)" : "var(--color-negative)" }}
                >
                  {nw.change >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                  {aud(nw.change, { sign: true })} ({pct(nw.changePct, 1)}) since last snapshot
                </div>
              )}
            </div>
            <Link href="/net-worth" className="text-xs" style={{ color: "var(--color-accent)" }}>
              View →
            </Link>
          </div>
          <div className="mt-2">
            <Sparkline data={series.map((s) => s.total)} />
          </div>
        </Card>

        {/* Month flow */}
        <Card>
          <div className="text-xs uppercase tracking-wide mb-3" style={{ color: "var(--color-muted)" }}>
            {monthLabel(month)} cash flow
          </div>
          <Row label="Income" value={aud(flow.income)} tone="positive" />
          <Row label="Spent" value={aud(flow.expense)} />
          <Row label="Net" value={aud(flow.net, { sign: true })} tone={flow.net >= 0 ? "positive" : "negative"} />
          <div className="mt-3 pt-3 border-t flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--color-muted)" }}>
              Savings rate
            </span>
            <Badge tone={flow.savingsRate >= 0.25 ? "positive" : flow.savingsRate >= 0.1 ? "warn" : "negative"}>
              {pct(flow.savingsRate)}
            </Badge>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left: budget + goals + recent */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="font-medium">Budget this month</div>
              <Link href="/budget" className="text-xs" style={{ color: "var(--color-accent)" }}>
                Details →
              </Link>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="num text-2xl font-semibold">{aud(actualSpend)}</span>
              <span className="text-sm" style={{ color: "var(--color-muted)" }}>
                of {aud(budgetTotal)} budgeted
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${budgetTotal ? Math.min(100, (actualSpend / budgetTotal) * 100) : 0}%`,
                  background: actualSpend > budgetTotal ? "var(--color-negative)" : "var(--color-accent)",
                }}
              />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="font-medium">Goal progress</div>
              <Link href="/goals" className="text-xs" style={{ color: "var(--color-accent)" }}>
                All goals →
              </Link>
            </div>
            <div className="space-y-3">
              {goals.map((g) => {
                const target = g.targetAmount ?? 0;
                const p = target ? Math.min(1, g.currentAmount / target) : 0;
                return (
                  <div key={g.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="truncate pr-2">{g.name}</span>
                      <span className="num shrink-0" style={{ color: "var(--color-muted)" }}>
                        {aud(g.currentAmount)} / {target ? aud(target) : "—"}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
                      <div className="h-full rounded-full" style={{ width: `${p * 100}%`, background: "var(--color-accent)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="font-medium">Recent transactions</div>
              <Link href="/transactions" className="text-xs" style={{ color: "var(--color-accent)" }}>
                View all →
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="text-sm py-6 text-center" style={{ color: "var(--color-muted)" }}>
                No transactions yet — import a CSV on the Transactions page.
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
                {recent.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate">{t.description || t.rawDescription}</div>
                      <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                        {fmtDate(t.date, "short")} · {t.subcategory?.name ?? "Uncategorised"}
                      </div>
                    </div>
                    <span
                      className="num shrink-0 pl-3"
                      style={{ color: t.amount >= 0 ? "var(--color-positive)" : "var(--color-text)" }}
                    >
                      {aud(t.amount, { cents: true, sign: t.amount > 0 })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right: needs attention — top alerts/warnings, deep-linked to their page */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-medium">Needs attention</div>
            <Link href="/budget" className="text-xs" style={{ color: "var(--color-accent)" }}>
              All insights →
            </Link>
          </div>
          {attention.length === 0 ? (
            <Card>
              <span className="text-sm" style={{ color: "var(--color-muted)" }}>
                Nothing pressing. Hit “Generate insights” on the Budget page to refresh.
              </span>
            </Card>
          ) : (
            attention.map((i) => (
              <Link key={i.id} href={insightHref(i)} className="block">
                <InsightCard dismissable={false} insight={i} />
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Drives the getting-started checklist: which pieces of the values → goals →
// habits chain already exist. Each is a cheap existence check.
async function getSetupProgress(): Promise<SetupProgress> {
  const [values, goals, habits, identity, routines, checkins] = await Promise.all([
    db.value.count(),
    db.goal.count(),
    db.habit.count({ where: { archived: false } }),
    db.habit.count({ where: { archived: false, NOT: { identityStatement: null } } }),
    db.habitStack.count(),
    db.dailyCheckin.count(),
  ]);
  return {
    values: values > 0,
    goals: goals > 0,
    habits: habits > 0,
    identity: identity > 0,
    routine: routines > 0,
    checkin: checkins > 0,
  };
}

function Row({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
}) {
  const color =
    tone === "positive" ? "var(--color-positive)" : tone === "negative" ? "var(--color-negative)" : "var(--color-text)";
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm" style={{ color: "var(--color-muted)" }}>
        {label}
      </span>
      <span className="num font-medium" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
