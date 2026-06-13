"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Upload, Wand2, AlertCircle, ListChecks } from "lucide-react";
import { aud, fmtDate, monthLabel } from "@/lib/format";
import { ImportDialog } from "./ImportDialog";
import { BulkCategorise } from "./BulkCategorise";

type Row = {
  id: string;
  date: string;
  description: string;
  rawDescription: string;
  amount: number;
  account: string;
  institution: string;
  subcategoryId: string | null;
  subcategory: string | null;
  category: string | null;
  kind: string | null;
  needsReview: boolean;
  notes: string | null;
};

export type CategoryTree = {
  id: string;
  name: string;
  kind: string;
  subs: { id: string; name: string; group: string | null }[];
}[];

type Account = { id: string; name: string };

export function TransactionsClient({
  tree,
  accounts,
  months,
}: {
  tree: CategoryTree;
  accounts: Account[];
  months: string[];
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [sum, setSum] = useState(0);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const [month, setMonth] = useState<string>("");
  const [q, setQ] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState("");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (q) params.set("q", q);
    if (accountId) params.set("accountId", accountId);
    if (categoryId) params.set("categoryId", categoryId);
    if (type) params.set("type", type);
    if (reviewOnly) params.set("needsReview", "1");
    params.set("limit", "500");
    const res = await fetch(`/api/transactions?${params.toString()}`);
    const data = await res.json();
    setRows(data.rows);
    setTotal(data.total);
    setSum(data.sum);
    setSelected(new Set());
    setLoading(false);
  }, [month, q, accountId, categoryId, type, reviewOnly]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(fetchRows, q ? 250 : 0);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [fetchRows, q]);

  async function recategorise(ids: string[], subcategoryId: string) {
    await fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, subcategoryId }),
    });
    fetchRows();
  }

  // Used by the bulk stepper — assigns without refetching so the queue stays stable.
  async function assignOne(id: string, subcategoryId: string, applyToMatching: boolean, matchText: string) {
    await fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id], subcategoryId, applyToMatching, matchText }),
    });
  }

  const uncategorised = useMemo(() => rows.filter((r) => !r.subcategoryId), [rows]);

  async function applyToMatching(row: Row) {
    if (!row.subcategoryId) return;
    const res = await fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: [row.id],
        subcategoryId: row.subcategoryId,
        applyToMatching: true,
        matchText: row.description,
      }),
    });
    const data = await res.json();
    if (data.retroApplied) alert(`Categorised ${data.retroApplied} more matching transactions + saved a rule.`);
    fetchRows();
  }

  const income = useMemo(() => rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0), [rows]);
  const expense = useMemo(
    () => rows.filter((r) => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0),
    [rows],
  );

  const allSelected = rows.length > 0 && selected.size === rows.length;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 flex-1 min-w-[200px]"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Search size={16} style={{ color: "var(--color-muted)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search description, merchant, notes…"
            className="bg-transparent outline-none text-sm flex-1"
          />
        </div>
        <Select value={month} onChange={setMonth} label="All months">
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </Select>
        <Select value={accountId} onChange={setAccountId} label="All accounts">
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Select value={categoryId} onChange={setCategoryId} label="All categories">
          {tree.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select value={type} onChange={setType} label="In & out">
          <option value="income">Income</option>
          <option value="expense">Expenses</option>
        </Select>
        <button
          onClick={() => setReviewOnly((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm"
          style={{
            background: reviewOnly ? "var(--color-accent-dim)" : "var(--color-surface)",
            border: "1px solid var(--color-border)",
            color: reviewOnly ? "var(--color-accent)" : "var(--color-muted)",
          }}
        >
          <AlertCircle size={15} /> Needs review
        </button>
        {uncategorised.length > 0 && (
          <button
            onClick={() => setBulkOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-warn)", color: "var(--color-warn)" }}
          >
            <ListChecks size={15} /> Categorise {uncategorised.length}
          </button>
        )}
        <button
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        >
          <Upload size={16} /> Import CSV
        </button>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-4 mb-3 text-sm" style={{ color: "var(--color-muted)" }}>
        <span>
          {total} txns{loading ? " · loading…" : ""}
        </span>
        <span className="num">
          In <span style={{ color: "var(--color-positive)" }}>{aud(income)}</span>
        </span>
        <span className="num">
          Out <span style={{ color: "var(--color-negative)" }}>{aud(expense)}</span>
        </span>
        <span className="num">
          Net{" "}
          <span style={{ color: sum >= 0 ? "var(--color-positive)" : "var(--color-negative)" }}>
            {aud(sum, { sign: true })}
          </span>
        </span>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div
          className="flex items-center gap-3 mb-3 rounded-lg px-3 py-2 text-sm"
          style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
        >
          <span>{selected.size} selected</span>
          <span style={{ color: "var(--color-muted)" }}>Set category →</span>
          <CategorySelect
            tree={tree}
            value=""
            onChange={(id) => recategorise([...selected], id)}
            placeholder="Choose…"
          />
          <button onClick={() => setSelected(new Set())} style={{ color: "var(--color-muted)" }}>
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--color-muted)" }} className="text-left">
                <th className="py-2.5 pl-4 pr-2 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) =>
                      setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())
                    }
                  />
                </th>
                <th className="py-2.5 px-2 font-medium">Date</th>
                <th className="py-2.5 px-2 font-medium">Description</th>
                <th className="py-2.5 px-2 font-medium text-right">Amount</th>
                <th className="py-2.5 px-2 font-medium w-64">Category</th>
                <th className="py-2.5 px-4 font-medium">Account</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-[var(--color-surface-2)]">
                  <td className="py-2 pl-4 pr-2">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        e.target.checked ? next.add(r.id) : next.delete(r.id);
                        setSelected(next);
                      }}
                    />
                  </td>
                  <td className="py-2 px-2 whitespace-nowrap" style={{ color: "var(--color-muted)" }}>
                    {fmtDate(r.date, "short")}
                  </td>
                  <td className="py-2 px-2 max-w-[280px]">
                    <div className="truncate" title={r.rawDescription}>
                      {r.description || r.rawDescription}
                    </div>
                  </td>
                  <td
                    className="num py-2 px-2 text-right whitespace-nowrap font-medium"
                    style={{ color: r.amount >= 0 ? "var(--color-positive)" : "var(--color-text)" }}
                  >
                    {aud(r.amount, { cents: true, sign: r.amount > 0 })}
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-1">
                      <CategorySelect
                        tree={tree}
                        value={r.subcategoryId ?? ""}
                        onChange={(id) => recategorise([r.id], id)}
                        flag={r.needsReview}
                      />
                      {r.subcategoryId && (
                        <button
                          title={`Apply "${r.category} › ${r.subcategory}" to all matching "${r.description}"`}
                          onClick={() => applyToMatching(r)}
                          className="shrink-0 opacity-50 hover:opacity-100"
                          style={{ color: "var(--color-accent)" }}
                        >
                          <Wand2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-4 whitespace-nowrap" style={{ color: "var(--color-muted)" }}>
                    {r.account}
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center" style={{ color: "var(--color-muted)" }}>
                    No transactions match these filters. Import a CSV to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {bulkOpen && uncategorised.length > 0 && (
        <BulkCategorise
          queue={uncategorised}
          tree={tree}
          onAssign={assignOne}
          onClose={() => {
            setBulkOpen(false);
            fetchRows();
          }}
        />
      )}

      {importOpen && (
        <ImportDialog
          accounts={accounts}
          tree={tree}
          onClose={() => setImportOpen(false)}
          onDone={() => {
            setImportOpen(false);
            fetchRows();
          }}
        />
      )}
    </div>
  );
}

function Select({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg px-3 py-2 text-sm"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: value ? "var(--color-text)" : "var(--color-muted)" }}
    >
      <option value="">{label}</option>
      {children}
    </select>
  );
}

export function CategorySelect({
  tree,
  value,
  onChange,
  flag,
  placeholder = "Uncategorised",
}: {
  tree: CategoryTree;
  value: string;
  onChange: (id: string) => void;
  flag?: boolean;
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      className="rounded-md px-2 py-1 text-xs max-w-[200px] truncate"
      style={{
        background: value ? "var(--color-surface-2)" : "transparent",
        border: `1px solid ${flag ? "var(--color-warn)" : "var(--color-border)"}`,
        color: value ? "var(--color-text)" : "var(--color-warn)",
      }}
    >
      <option value="">{placeholder}</option>
      {tree.map((c) => (
        <optgroup key={c.id} label={c.name}>
          {c.subs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.group ? `${s.group} › ${s.name}` : s.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
