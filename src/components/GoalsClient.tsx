"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, X, Trash2, ArrowUpRight } from "lucide-react";
import { Card, Badge } from "@/components/ui";
import { HintCard, InfoTip, CoachEmptyState } from "@/components/Guidance";
import { PAGE_HINTS, COACH } from "@/lib/guidance";
import { Portal } from "@/components/Portal";
import { DatePicker } from "@/components/DatePicker";
import { aud, fmtDate } from "@/lib/format";
import { readBuyInput, isHouseGoal, buySummary, projectBuy, type BuyInput } from "@/lib/buy";

export type GoalDTO = {
  id: string;
  name: string;
  term: string;
  kind: string; // financial | habit | outcome
  targetAmount: number | null;
  currentAmount: number;
  targetDate: string | null; // YYYY-MM-DD
  linkedBuckets: string[];
  notes: string | null;
  valueId: string | null;
};

export type ValueRef = { id: string; name: string };

function weeksBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 7));
}

// Project BUY drives the house goal's target + subtitle. Its settings live in
// localStorage, so derive them client-side once mounted.
function useBuyDerived(): { target: number; subtitle: string } | null {
  const [input, setInput] = useState<BuyInput | null>(null);
  useEffect(() => {
    setInput(readBuyInput());
    const onStorage = () => setInput(readBuyInput());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  if (!input) return null;
  return { target: projectBuy(input).perPersonUpfront, subtitle: buySummary(input) };
}

export function GoalsClient({ goals, buckets, values }: { goals: GoalDTO[]; buckets: string[]; values: ValueRef[] }) {
  const [editing, setEditing] = useState<GoalDTO | null>(null);
  const [adding, setAdding] = useState(false);
  const buy = useBuyDerived();

  const short = goals.filter((g) => g.term === "short");
  const long = goals.filter((g) => g.term === "long");

  return (
    <div>
      <HintCard hint={PAGE_HINTS.goals} />
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
          This year
          <InfoTip concept="short-goal" />
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        >
          <Plus size={16} /> Add goal
        </button>
      </div>

      {short.length === 0 ? (
        <CoachEmptyState
          coach={COACH.goals}
          action={
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
              style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
            >
              <Plus size={16} /> Add your first goal
            </button>
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {short.map((g) => (
            <GoalCard key={g.id} g={g} buy={isHouseGoal(g) ? buy : null} onClick={() => setEditing(g)} />
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide mb-3" style={{ color: "var(--color-muted)" }}>
        Long term
        <InfoTip concept="long-goal" />
      </div>
      {long.length === 0 ? (
        <Card className="text-center py-8 text-sm" >
          <span style={{ color: "var(--color-muted)" }}>
            No long-term goals yet — the 1–5 year picture your yearly goals build toward.
          </span>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {long.map((g) => (
            <GoalCard key={g.id} g={g} buy={isHouseGoal(g) ? buy : null} onClick={() => setEditing(g)} />
          ))}
        </div>
      )}

      {editing && <GoalModal goal={editing} buckets={buckets} values={values} onClose={() => setEditing(null)} />}
      {adding && <GoalModal goal={null} buckets={buckets} values={values} onClose={() => setAdding(false)} />}
    </div>
  );
}

function GoalCard({ g, buy, onClick }: { g: GoalDTO; buy?: { target: number; subtitle: string } | null; onClick: () => void }) {
  const now = new Date();
  // The house goal takes its target & subtitle from the Project BUY calculator;
  // current amount still pulls through from the linked net-worth buckets.
  const target = buy ? buy.target : g.targetAmount ?? 0;
  const subtitle = buy ? buy.subtitle : g.notes;
  const progress = target > 0 ? Math.min(1, g.currentAmount / target) : 0;
  const remaining = Math.max(0, target - g.currentAmount);
  const weeks = g.targetDate ? weeksBetween(now, new Date(g.targetDate)) : null;
  const perWeek = weeks && weeks > 0 ? remaining / weeks : null;
  const done = progress >= 1 && target > 0;

  const body = (
    <Card className="h-full transition-colors hover:border-[var(--color-accent)]">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="font-medium">{g.name}</div>
          {subtitle && (
            <div className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
              {subtitle}
            </div>
          )}
        </div>
        {done ? (
          <Badge tone="positive">done</Badge>
        ) : g.targetDate ? (
          <Badge tone="accent">{fmtDate(g.targetDate, "month")}</Badge>
        ) : (
          <Badge>long term</Badge>
        )}
      </div>

      <div className="flex items-baseline justify-between mb-1.5">
        <span className="num text-lg font-semibold">{aud(g.currentAmount)}</span>
        <span className="num text-sm" style={{ color: "var(--color-muted)" }}>
          of {target ? aud(target) : "—"}
        </span>
      </div>

      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${progress * 100}%`, background: done ? "var(--color-positive)" : "var(--color-accent)" }}
        />
      </div>

      <div className="flex items-center justify-between mt-3 text-xs" style={{ color: "var(--color-muted)" }}>
        <span>{Math.round(progress * 100)}% complete</span>
        {perWeek != null && !done && (
          <span>
            <span className="num font-medium" style={{ color: "var(--color-text)" }}>
              {aud(perWeek, { cents: true })}
            </span>
            /week to hit it
          </span>
        )}
        {weeks != null && !done && <span>{Math.round(weeks)} weeks left</span>}
      </div>
      <div className="flex items-center justify-between mt-2 gap-2">
        {g.linkedBuckets.length > 0 ? (
          <div className="text-[10px]" style={{ color: "var(--color-muted)" }}>
            ↻ auto-synced from {g.linkedBuckets.join(", ")}
          </div>
        ) : (
          <span />
        )}
        {buy && (
          <Link
            href="/project-buy"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium shrink-0 transition-colors"
            style={{ background: "var(--color-accent-dim)", border: "1px solid var(--color-accent)", color: "var(--color-accent)" }}
          >
            Project BUY <ArrowUpRight size={12} />
          </Link>
        )}
      </div>
    </Card>
  );

  // House goal uses a clickable div (not a button) so the Project BUY link can
  // live inside it without nesting interactive elements.
  if (buy) {
    return (
      <div onClick={onClick} className="text-left cursor-pointer">
        {body}
      </div>
    );
  }
  return (
    <button onClick={onClick} className="text-left">
      {body}
    </button>
  );
}

const inputStyle = { background: "var(--color-surface-2)", border: "1px solid var(--color-border)" } as const;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs mb-1" style={{ color: "var(--color-muted)" }}>
        {label}
        {hint && <InfoTip concept={hint} />}
      </label>
      {children}
    </div>
  );
}

function GoalModal({ goal, buckets, values, onClose }: { goal: GoalDTO | null; buckets: string[]; values: ValueRef[]; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: goal?.name ?? "",
    term: goal?.term ?? "short",
    kind: goal?.kind ?? "financial",
    valueId: goal?.valueId ?? "",
    targetAmount: goal?.targetAmount != null ? String(goal.targetAmount) : "",
    currentAmount: goal != null ? String(goal.currentAmount) : "",
    targetDate: goal?.targetDate ?? "",
    notes: goal?.notes ?? "",
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  // House goal's target & description are driven by the Project BUY calculator.
  const isHouse = goal != null && isHouseGoal(goal);
  const [linkedBuckets, setLinkedBuckets] = useState<string[]>(goal?.linkedBuckets ?? []);
  const toggleBucket = (b: string) =>
    setLinkedBuckets((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));

  async function save() {
    setBusy(true);
    const payload = {
      ...(goal ? { id: goal.id } : {}),
      name: f.name,
      term: f.term,
      kind: f.kind,
      valueId: f.valueId || null,
      // House goal's target & description come from Project BUY — keep the
      // stored values untouched rather than writing the disabled placeholders.
      targetAmount: isHouse ? goal!.targetAmount : f.targetAmount === "" ? null : Number(f.targetAmount),
      currentAmount: f.currentAmount === "" ? 0 : Number(f.currentAmount),
      targetDate: f.targetDate || null,
      linkedBuckets,
      notes: isHouse ? goal!.notes : f.notes,
    };
    const res = await fetch("/api/goals", {
      method: goal ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      onClose();
      router.refresh();
    }
  }

  async function remove() {
    if (!goal) return;
    setBusy(true);
    await fetch("/api/goals", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: goal.id }),
    });
    setBusy(false);
    onClose();
    router.refresh();
  }

  return (
    <Portal>
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="anim-overlay fixed inset-0 z-50 grid place-items-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
      <div className="anim-pop card p-6 w-full max-w-md my-8">
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold">{goal ? "Edit goal" : "New goal"}</div>
          <button onClick={onClose} style={{ color: "var(--color-muted)" }}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Title">
            <input
              autoFocus
              value={f.name}
              onChange={(e) => set("name", e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
            />
          </Field>
          <Field label={isHouse ? "Description (set in Project BUY)" : "Description"}>
            <textarea
              value={isHouse ? "Auto-generated from your Project BUY settings." : f.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              disabled={isHouse}
              className="w-full rounded-lg px-3 py-2 text-sm resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              style={inputStyle}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kind">
              <select value={f.kind} onChange={(e) => set("kind", e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                <option value="financial">Financial</option>
                <option value="habit">Habit-driven</option>
                <option value="outcome">Outcome</option>
              </select>
            </Field>
            <Field label="Value it serves">
              <select value={f.valueId} onChange={(e) => set("valueId", e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                <option value="">— none —</option>
                {values.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Term" hint="goal">
              <select value={f.term} onChange={(e) => set("term", e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                <option value="short">This year</option>
                <option value="long">Long term</option>
              </select>
            </Field>
            <Field label="Target date">
              <DatePicker value={f.targetDate} onChange={(v) => set("targetDate", v)} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
            </Field>
            <Field label={isHouse ? "Target (in Project BUY)" : "Target amount"} hint="lagging-indicator">
              <input type="number" inputMode="decimal" value={f.targetAmount} onChange={(e) => set("targetAmount", e.target.value)} disabled={isHouse} className="w-full rounded-lg px-3 py-2 text-sm num disabled:opacity-50 disabled:cursor-not-allowed" style={inputStyle} />
            </Field>
            <Field label="Current amount">
              <input type="number" inputMode="decimal" value={f.currentAmount} onChange={(e) => set("currentAmount", e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm num" style={inputStyle} />
            </Field>
          </div>
          <Field label="Auto-sync from net-worth buckets (optional, pick any)">
            <div className="grid grid-cols-2 gap-1.5">
              {buckets.map((b) => {
                const on = linkedBuckets.includes(b);
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => toggleBucket(b)}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors"
                    style={{
                      background: on ? "var(--color-accent-dim)" : "var(--color-surface-2)",
                      border: `1px solid ${on ? "var(--color-accent)" : "var(--color-border)"}`,
                      color: on ? "var(--color-accent)" : "var(--color-muted)",
                    }}
                  >
                    <span
                      className="inline-block h-3 w-3 rounded-[4px] shrink-0"
                      style={{ background: on ? "var(--color-accent)" : "transparent", border: `1px solid ${on ? "var(--color-accent)" : "var(--color-border)"}` }}
                    />
                    {b}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>

        <div className="flex items-center gap-2 mt-5">
          <button
            onClick={save}
            disabled={busy || f.name.trim() === ""}
            className="flex-1 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
          >
            {busy ? "Saving…" : goal ? "Save changes" : "Create goal"}
          </button>
          {goal && (
            <button
              onClick={remove}
              disabled={busy}
              title="Delete goal"
              className="rounded-lg px-3 py-2 text-sm disabled:opacity-50 flex items-center gap-1.5"
              style={{ background: "var(--color-surface-2)", color: "var(--color-negative)" }}
            >
              <Trash2 size={15} /> Delete
            </button>
          )}
        </div>
        {isHouse && (
          <p className="text-[10px] mt-3" style={{ color: "var(--color-muted)" }}>
            Target and description are modelled in Project BUY — edit them there.
          </p>
        )}
        {linkedBuckets.length > 0 && (
          <p className="text-[10px] mt-3" style={{ color: "var(--color-muted)" }}>
            Current amount is the sum of {linkedBuckets.join(" + ")} and updates with each net-worth
            snapshot.
          </p>
        )}
      </div>
    </div>
    </Portal>
  );
}
