"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, X, SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui";
import { Portal } from "@/components/Portal";
import { Sparkline } from "@/components/Sparkline";
import { CategoryManager } from "@/components/CategoryManager";
import { CategorySelect, type CategoryTree } from "@/components/TransactionsClient";
import { aud, fmtDate, pct } from "@/lib/format";
import type { BudgetTxn } from "@/lib/queries";

export type BudgetSub = {
  id: string;
  name: string;
  group: string | null;
  projected: number;
  actual: number;
};
export type BudgetCat = { id: string; name: string; subs: BudgetSub[] };
export type SubTrend = { spark: number[]; mom: number | null; yoy: number | null };

type SubTarget = { sub: BudgetSub; catName: string } | null;
type AddTarget = { catName: string; subs: BudgetSub[] } | null;

export function BudgetEditor({
  categories,
  txnsBySub,
  tree,
  trends,
  colorByCat,
}: {
  categories: BudgetCat[];
  txnsBySub: Record<string, BudgetTxn[]>;
  tree: CategoryTree;
  trends: Record<string, SubTrend>;
  colorByCat: Record<string, string>;
}) {
  const router = useRouter();
  const [budgetTarget, setBudgetTarget] = useState<SubTarget>(null);
  const [txnTarget, setTxnTarget] = useState<SubTarget>(null);
  const [adding, setAdding] = useState<AddTarget>(null);
  const [settingUp, setSettingUp] = useState(false);
  const [managing, setManaging] = useState(false);

  async function setupTaxonomy() {
    setSettingUp(true);
    await fetch("/api/taxonomy", { method: "POST" });
    router.refresh();
    setSettingUp(false);
  }

  async function putBudget(subcategoryId: string, projectedAmount: number) {
    await fetch("/api/budget", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subcategoryId, projectedAmount }),
    });
    router.refresh();
  }
  async function delBudget(subcategoryId: string) {
    await fetch("/api/budget", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subcategoryId }),
    });
    router.refresh();
  }
  async function recategorise(id: string, subcategoryId: string) {
    await fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id], subcategoryId }),
    });
    router.refresh();
  }

  if (categories.length === 0) {
    return (
      <Card>
        <div className="py-10 text-center">
          <div className="font-semibold mb-1">No categories yet</div>
          <div className="text-sm mb-5" style={{ color: "var(--color-muted)" }}>
            Start with the standard categories (Income, Needs, Wants, Investment…) and tweak
            them, or build your own from scratch.
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={setupTaxonomy}
              disabled={settingUp}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
            >
              <Plus size={15} /> {settingUp ? "Setting up…" : "Set up standard categories"}
            </button>
            <button
              onClick={() => setManaging(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            >
              <SlidersHorizontal size={15} /> Build my own
            </button>
          </div>
        </div>
        {managing && <CategoryManager tree={tree} onClose={() => setManaging(false)} />}
      </Card>
    );
  }

  return (
    <div className="space-y-6 stagger">
      <div className="flex justify-end -mb-2">
        <button
          onClick={() => setManaging(true)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
          style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}
        >
          <SlidersHorizontal size={14} /> Manage categories
        </button>
      </div>
      {categories.map((c) => {
        const active = c.subs.filter((s) => s.projected || s.actual);
        const unbudgeted = c.subs.filter((s) => !s.projected);
        const catProjected = active.reduce((x, s) => x + s.projected, 0);
        const catActual = active.reduce((x, s) => x + s.actual, 0);
        if (active.length === 0 && unbudgeted.length === 0) return null;

        return (
          <Card key={c.id}>
            <div className="flex items-start justify-between mb-4 gap-3">
              <div>
                <div className="font-semibold">{c.name}</div>
                <div className="num text-sm mt-0.5" style={{ color: "var(--color-muted)" }}>
                  {aud(catActual)} <span className="opacity-50">/ {aud(catProjected)}</span>
                </div>
              </div>
              {unbudgeted.length > 0 && (
                <button
                  onClick={() => setAdding({ catName: c.name, subs: unbudgeted })}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium shrink-0"
                  style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-accent)" }}
                >
                  <Plus size={14} /> Add budget line
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {active.map((s) => {
                const over = s.actual > s.projected && s.projected > 0;
                const ratio =
                  s.projected > 0 ? Math.min(1.5, s.actual / s.projected) : s.actual > 0 ? 1 : 0;
                const txnCount = (txnsBySub[s.id] ?? []).length;
                const trend = trends[s.id];
                return (
                  <div
                    key={s.id}
                    onClick={() => setTxnTarget({ sub: s, catName: c.name })}
                    className="rounded-lg -mx-2 px-2 py-1.5 cursor-pointer transition-colors hover:bg-[var(--color-surface-2)]"
                  >
                    <div className="flex items-center gap-3 text-sm mb-1.5">
                      <span className="flex-1 min-w-0 truncate">
                        {s.group && <span style={{ color: "var(--color-muted)" }}>{s.group} › </span>}
                        {s.name}
                        {txnCount > 0 && (
                          <span className="ml-2 text-xs" style={{ color: "var(--color-muted)" }}>
                            {txnCount} txn{txnCount === 1 ? "" : "s"}
                          </span>
                        )}
                      </span>
                      <LineTrend trend={trend} color={colorByCat[c.id] ?? "#8a98a8"} />
                      {/* Amount is its own click target → budget editor */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setBudgetTarget({ sub: s, catName: c.name });
                        }}
                        title="Edit budget for this line"
                        className="num shrink-0 rounded-md px-1.5 py-0.5 -my-0.5 transition-colors hover:bg-[var(--color-surface)]"
                        style={{ color: over ? "var(--color-negative)" : "var(--color-muted)" }}
                      >
                        {aud(s.actual)}{" "}
                        <span className="opacity-50">/ {s.projected ? aud(s.projected) : "—"}</span>
                      </button>
                    </div>
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: "var(--color-surface-2)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, ratio * 100)}%`,
                          background: over ? "var(--color-negative)" : "var(--color-accent)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      {budgetTarget && (
        <BudgetModal
          target={budgetTarget}
          onClose={() => setBudgetTarget(null)}
          onSave={async (amt) => {
            await putBudget(budgetTarget.sub.id, amt);
            setBudgetTarget(null);
          }}
          onRemove={async () => {
            await delBudget(budgetTarget.sub.id);
            setBudgetTarget(null);
          }}
        />
      )}

      {txnTarget && (
        <TxnModal
          target={txnTarget}
          txns={txnsBySub[txnTarget.sub.id] ?? []}
          tree={tree}
          onClose={() => setTxnTarget(null)}
          onRecategorise={recategorise}
        />
      )}

      {adding && (
        <AddModal
          target={adding}
          onClose={() => setAdding(null)}
          onSave={async (subId, amt) => {
            await putBudget(subId, amt);
            setAdding(null);
          }}
        />
      )}

      {managing && <CategoryManager tree={tree} onClose={() => setManaging(false)} />}
    </div>
  );
}

// Compact spend trend shown inline on each budget line.
function LineTrend({ trend, color }: { trend: SubTrend | undefined; color: string }) {
  const hasData = trend && trend.spark.some((v) => v > 0) && trend.spark.length > 1;
  if (!hasData) return <div className="w-[136px] shrink-0" aria-hidden />;
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="w-20 h-7">
        <Sparkline data={trend!.spark} color={color} height={28} />
      </div>
      <div className="text-[10px] leading-tight w-[44px] text-right" style={{ color: "var(--color-muted)" }}>
        <div>
          MoM <Pctd v={trend!.mom} />
        </div>
        <div>
          YoY <Pctd v={trend!.yoy} />
        </div>
      </div>
    </div>
  );
}

// Spend delta: up = worse (red), down = better (green).
function Pctd({ v }: { v: number | null }) {
  if (v === null) return <span className="opacity-50">—</span>;
  const tone = v > 0 ? "var(--color-negative)" : v < 0 ? "var(--color-positive)" : "var(--color-muted)";
  return (
    <span className="num font-medium" style={{ color: tone }}>
      {v > 0 ? "+" : v < 0 ? "−" : ""}
      {pct(Math.abs(v), 0)}
    </span>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  wide = false,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Portal>
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="anim-overlay fixed inset-0 z-50 grid place-items-center p-4 overflow-y-auto"
        style={{ background: "rgba(0,0,0,0.6)" }}
      >
        <div className={`anim-pop card p-6 w-full my-8 ${wide ? "max-w-4xl" : "max-w-sm"}`}>
          <div className="flex items-start justify-between mb-4 gap-3">
            <div>
              <div className="font-semibold">{title}</div>
              {subtitle && (
                <div className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
                  {subtitle}
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ color: "var(--color-muted)" }} className="shrink-0">
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </Portal>
  );
}

const inputStyle = { background: "var(--color-surface-2)", border: "1px solid var(--color-border)" } as const;

function BudgetModal({
  target,
  onClose,
  onSave,
  onRemove,
}: {
  target: { sub: BudgetSub; catName: string };
  onClose: () => void;
  onSave: (amount: number) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const { sub, catName } = target;
  const [value, setValue] = useState(sub.projected ? String(sub.projected) : "");
  const [busy, setBusy] = useState(false);

  return (
    <ModalShell
      title={sub.group ? `${sub.group} › ${sub.name}` : sub.name}
      subtitle={`${catName} · spent ${aud(sub.actual)} this month`}
      onClose={onClose}
    >
      <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>
        Monthly budget
      </label>
      <input
        type="number"
        inputMode="decimal"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value !== "") {
            setBusy(true);
            onSave(Number(value));
          }
        }}
        className="w-full rounded-lg px-3 py-2 text-sm num"
        style={inputStyle}
      />
      <div className="flex items-center gap-2 mt-5">
        <button
          onClick={() => {
            setBusy(true);
            onSave(Number(value || 0));
          }}
          disabled={busy || value === ""}
          className="flex-1 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => {
            setBusy(true);
            onRemove();
          }}
          disabled={busy}
          title="Delete budget line"
          className="rounded-lg px-3 py-2 text-sm disabled:opacity-50 flex items-center gap-1.5"
          style={{ background: "var(--color-surface-2)", color: "var(--color-negative)" }}
        >
          <Trash2 size={15} /> Delete
        </button>
      </div>
    </ModalShell>
  );
}

function TxnModal({
  target,
  txns,
  tree,
  onClose,
  onRecategorise,
}: {
  target: { sub: BudgetSub; catName: string };
  txns: BudgetTxn[];
  tree: CategoryTree;
  onClose: () => void;
  onRecategorise: (id: string, subcategoryId: string) => Promise<void>;
}) {
  const { sub, catName } = target;
  const total = txns.reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <ModalShell
      title={sub.group ? `${sub.group} › ${sub.name}` : sub.name}
      subtitle={`${catName} · ${txns.length} transaction${txns.length === 1 ? "" : "s"} · ${aud(total)} this month`}
      onClose={onClose}
      wide
    >
      {txns.length === 0 ? (
        <div className="py-10 text-center text-sm" style={{ color: "var(--color-muted)" }}>
          No transactions in this category this month.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--color-muted)" }} className="text-left text-xs">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 px-3 font-medium">Description</th>
                <th className="py-2 px-3 font-medium">Account</th>
                <th className="py-2 px-3 font-medium">Category</th>
                <th className="py-2 pl-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="py-2 pr-3 whitespace-nowrap" style={{ color: "var(--color-muted)" }}>
                    {fmtDate(t.date, "short")}
                  </td>
                  <td className="py-2 px-3 max-w-[220px]">
                    <div className="truncate" title={t.description}>
                      {t.description}
                    </div>
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap" style={{ color: "var(--color-muted)" }}>
                    {t.account}
                  </td>
                  <td className="py-2 px-3">
                    <CategorySelect
                      tree={tree}
                      value={t.subcategoryId}
                      onChange={(id) => {
                        if (id !== t.subcategoryId) onRecategorise(t.id, id);
                      }}
                    />
                  </td>
                  <td
                    className="num py-2 pl-3 text-right whitespace-nowrap font-medium"
                    style={{ color: t.amount >= 0 ? "var(--color-positive)" : "var(--color-text)" }}
                  >
                    {aud(t.amount, { cents: true, sign: t.amount > 0 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs mt-4" style={{ color: "var(--color-muted)" }}>
        Change a category here and it updates the Transactions tab and every total instantly.
      </p>
    </ModalShell>
  );
}

function AddModal({
  target,
  onClose,
  onSave,
}: {
  target: { catName: string; subs: BudgetSub[] };
  onClose: () => void;
  onSave: (subId: string, amount: number) => Promise<void>;
}) {
  const [subId, setSubId] = useState(target.subs[0]?.id ?? "");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <ModalShell title={`Add budget line · ${target.catName}`} onClose={onClose}>
      <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>
        Subcategory
      </label>
      <select
        value={subId}
        onChange={(e) => setSubId(e.target.value)}
        className="w-full rounded-lg px-3 py-2 text-sm mb-4"
        style={inputStyle}
      >
        {target.subs.map((s) => (
          <option key={s.id} value={s.id}>
            {s.group ? `${s.group} › ${s.name}` : s.name}
          </option>
        ))}
      </select>
      <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>
        Monthly budget
      </label>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && subId && value !== "") {
            setBusy(true);
            onSave(subId, Number(value));
          }
        }}
        className="w-full rounded-lg px-3 py-2 text-sm num"
        style={inputStyle}
      />
      <button
        onClick={() => {
          setBusy(true);
          onSave(subId, Number(value || 0));
        }}
        disabled={busy || !subId || value === ""}
        className="mt-5 w-full rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
      >
        {busy ? "Saving…" : "Add line"}
      </button>
    </ModalShell>
  );
}
