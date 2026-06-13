"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2 } from "lucide-react";
import { Portal } from "@/components/Portal";
import { DatePicker } from "@/components/DatePicker";
import { aud } from "@/lib/format";
import type { BucketMeta } from "@/lib/queries";

type Point = { date: string; total: number; [bucket: string]: number | string } | null;

type Row = {
  key: string;
  name: string;
  custom: boolean; // name is editable
  amount: string; // magnitude, always positive in the UI
  isLiability: boolean;
};

let counter = 0;
const newKey = () => `row-${counter++}`;

export function AddSnapshot({ buckets, latest }: { buckets: BucketMeta[]; latest: Point }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);

  const initialRows = (): Row[] =>
    buckets.map((b) => {
      const raw = latest && latest[b.name] != null ? Number(latest[b.name]) : null;
      return {
        key: newKey(),
        name: b.name,
        custom: false,
        amount: raw != null ? String(Math.abs(raw)) : "",
        isLiability: b.isLiability,
      };
    });

  const [rows, setRows] = useState<Row[]>(initialRows);

  function reset() {
    setDate(today);
    setRows(initialRows());
  }

  const setRow = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));
  const addRow = (isLiability: boolean) =>
    setRows((rs) => [...rs, { key: newKey(), name: "", custom: true, amount: "", isLiability }]);

  const signed = (r: Row) => (r.isLiability ? -1 : 1) * Math.abs(Number(r.amount || 0));
  const netTotal = rows.reduce((t, r) => t + signed(r), 0);

  async function save() {
    setSaving(true);
    const entries = rows
      .filter((r) => r.name.trim() !== "")
      .map((r) => ({ bucket: r.name.trim(), amount: signed(r) }));
    const res = await fetch("/api/net-worth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, entries }),
    });
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
      >
        <Plus size={16} /> Add snapshot
      </button>
    );
  }

  return (
    <Portal>
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className="anim-overlay fixed inset-0 z-50 grid place-items-center p-4 overflow-y-auto"
        style={{ background: "rgba(0,0,0,0.6)" }}
      >
        <div className="anim-pop card p-6 w-full max-w-lg my-8">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold">New net worth snapshot</div>
            <button onClick={() => setOpen(false)} style={{ color: "var(--color-muted)" }}>
              <X size={18} />
            </button>
          </div>

          <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>
            Date
          </label>
          <div className="mb-4">
            <DatePicker
              value={date}
              onChange={setDate}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
            />
          </div>

          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center mb-1 text-[10px] uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
            <span>Asset class</span>
            <span className="px-1">Type</span>
            <span className="text-right pr-1">Amount</span>
            <span />
          </div>

          <div className="space-y-1.5 max-h-[42vh] overflow-y-auto pr-1">
            {rows.map((r) => (
              <div key={r.key} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                {r.custom ? (
                  <input
                    value={r.name}
                    autoFocus
                    placeholder="Name (e.g. Car loan)"
                    onChange={(e) => setRow(r.key, { name: e.target.value })}
                    className="rounded-lg px-2.5 py-1.5 text-sm min-w-0"
                    style={inputStyle}
                  />
                ) : (
                  <span className="text-sm truncate" title={r.name}>
                    {r.name}
                  </span>
                )}

                <TypeToggle
                  isLiability={r.isLiability}
                  onChange={(v) => setRow(r.key, { isLiability: v })}
                />

                <input
                  type="number"
                  inputMode="decimal"
                  value={r.amount}
                  onChange={(e) => setRow(r.key, { amount: e.target.value })}
                  className="num w-28 rounded-lg px-2.5 py-1.5 text-sm text-right"
                  style={inputStyle}
                />

                <button
                  onClick={() => removeRow(r.key)}
                  title="Remove"
                  className="p-1 opacity-50 hover:opacity-100"
                  style={{ color: "var(--color-muted)" }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-3">
            <button onClick={() => addRow(false)} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--color-accent)" }}>
              <Plus size={13} /> Add asset
            </button>
            <button onClick={() => addRow(true)} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--color-negative)" }}>
              <Plus size={13} /> Add liability
            </button>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: "1px solid var(--color-border)" }}>
            <span className="text-sm" style={{ color: "var(--color-muted)" }}>
              Net worth
            </span>
            <span className="num font-semibold" style={{ color: netTotal >= 0 ? "var(--color-text)" : "var(--color-negative)" }}>
              {aud(netTotal)}
            </span>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="mt-4 w-full rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
          >
            {saving ? "Saving…" : "Save snapshot"}
          </button>
        </div>
      </div>
    </Portal>
  );
}

const inputStyle = { background: "var(--color-surface-2)", border: "1px solid var(--color-border)" } as const;

function TypeToggle({ isLiability, onChange }: { isLiability: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="inline-flex rounded-lg p-0.5 text-[10px]" style={inputStyle}>
      {[
        [false, "Asset", "var(--color-accent)"],
        [true, "Liab.", "var(--color-negative)"],
      ].map(([v, label, color]) => {
        const on = isLiability === v;
        return (
          <button
            key={String(v)}
            onClick={() => onChange(v as boolean)}
            className="rounded-md px-2 py-1 font-medium transition-colors"
            style={{ background: on ? (color as string) : "transparent", color: on ? "var(--color-bg)" : "var(--color-muted)" }}
          >
            {label as string}
          </button>
        );
      })}
    </div>
  );
}
