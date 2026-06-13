"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Trash2, AlertTriangle, Pencil } from "lucide-react";
import { Portal } from "@/components/Portal";
import { aud, fmtDate } from "@/lib/format";

type Point = { date: string; total: number; [bucket: string]: number | string };

const CONFIRM_PHRASE = "Delete this date's entry";

export function NetWorthHistory({
  series,
  buckets,
  selected = [],
}: {
  series: Point[];
  buckets: string[];
  selected?: string[];
}) {
  const [open, setOpen] = useState<Point | null>(null);
  const highlight = (b: string) => selected.length > 0 && selected.includes(b);
  const cellHL = (b: string) => (highlight(b) ? { background: "var(--color-accent-dim)" } : undefined);

  return (
    <div className="card p-5">
      <div className="text-sm font-medium mb-4">History</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: "var(--color-muted)" }} className="text-left">
              <th className="py-2 pr-4 font-medium">Date</th>
              {buckets.map((b) => (
                <th
                  key={b}
                  className="py-2 px-3 font-medium text-right whitespace-nowrap"
                  style={{ ...cellHL(b), color: highlight(b) ? "var(--color-accent)" : undefined }}
                >
                  {b}
                </th>
              ))}
              <th className="py-2 pl-3 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {[...series].reverse().map((s) => (
              <tr
                key={s.date}
                onClick={() => setOpen(s)}
                className="border-t cursor-pointer transition-colors hover:bg-[var(--color-surface-2)]"
              >
                <td className="py-2 pr-4 whitespace-nowrap">{fmtDate(s.date)}</td>
                {buckets.map((b) => (
                  <td
                    key={b}
                    className="num py-2 px-3 text-right"
                    style={{
                      ...cellHL(b),
                      color: Number(s[b]) < 0 ? "var(--color-negative)" : highlight(b) ? "var(--color-text)" : "var(--color-muted)",
                    }}
                  >
                    {s[b] != null ? aud(Number(s[b])) : "—"}
                  </td>
                ))}
                <td className="num py-2 pl-3 text-right font-semibold">{aud(s.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && <EntryModal point={open} buckets={buckets} onClose={() => setOpen(null)} />}
    </div>
  );
}

type Mode = "view" | "edit";

function EntryModal({ point, buckets, onClose }: { point: Point; buckets: string[]; onClose: () => void }) {
  const router = useRouter();
  const rows = buckets.filter((b) => point[b] != null);

  const [mode, setMode] = useState<Mode>("view");
  const [busy, setBusy] = useState(false);

  // delete: 0 buttons · 1 are-you-sure · 2 type-to-confirm
  const [delStep, setDelStep] = useState<0 | 1 | 2>(0);
  const [phrase, setPhrase] = useState("");

  // edit: 0 editing · 1 confirm-once · 2 confirm-twice
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((b) => [b, String(point[b])])),
  );
  const [saveStep, setSaveStep] = useState<0 | 1 | 2>(0);
  const editedTotal = rows.reduce((t, b) => t + (Number(vals[b]) || 0), 0);

  async function doDelete() {
    setBusy(true);
    const res = await fetch("/api/net-worth", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: point.date }),
    });
    setBusy(false);
    if (res.ok) {
      onClose();
      router.refresh();
    }
  }

  async function doSave() {
    setBusy(true);
    const entries = rows.map((b) => ({ bucket: b, amount: Number(vals[b]) || 0 }));
    const res = await fetch("/api/net-worth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: point.date, entries }),
    });
    setBusy(false);
    if (res.ok) {
      onClose();
      router.refresh();
    }
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
            <div className="font-semibold">
              {fmtDate(point.date)}
              {mode === "edit" && <span className="text-xs ml-2" style={{ color: "var(--color-muted)" }}>editing</span>}
            </div>
            <button onClick={onClose} style={{ color: "var(--color-muted)" }}>
              <X size={18} />
            </button>
          </div>

          {/* Breakdown — read-only in view mode, inputs in edit mode */}
          <div className="space-y-1.5 mb-2">
            {rows.map((b) => (
              <div key={b} className="flex items-center justify-between gap-3 text-sm">
                <span style={{ color: "var(--color-muted)" }}>{b}</span>
                {mode === "edit" && saveStep === 0 ? (
                  <input
                    type="number"
                    inputMode="decimal"
                    value={vals[b]}
                    onChange={(e) => setVals((v) => ({ ...v, [b]: e.target.value }))}
                    className="num w-32 rounded-md px-2 py-1 text-sm text-right"
                    style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
                  />
                ) : (
                  <span className="num" style={{ color: Number((mode === "edit" ? vals[b] : point[b])) < 0 ? "var(--color-negative)" : "var(--color-text)" }}>
                    {aud(Number(mode === "edit" ? vals[b] : point[b]) || 0)}
                  </span>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 mt-1 font-semibold" style={{ borderTop: "1px solid var(--color-border)" }}>
              <span>Total</span>
              <span className="num">{aud(mode === "edit" ? editedTotal : point.total)}</span>
            </div>
          </div>

          {/* VIEW: edit + delete entry points */}
          {mode === "view" && delStep === 0 && (
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setMode("edit")}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
                style={{ background: "var(--color-surface-2)", color: "var(--color-accent)" }}
              >
                <Pencil size={15} /> Edit
              </button>
              <button
                onClick={() => setDelStep(1)}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
                style={{ background: "var(--color-surface-2)", color: "var(--color-negative)" }}
              >
                <Trash2 size={15} /> Delete
              </button>
            </div>
          )}

          {/* DELETE flow */}
          {mode === "view" && delStep === 1 && (
            <Guard
              tone="negative"
              title="Are you sure?"
              body={`This permanently removes ${fmtDate(point.date)} from your net-worth history.`}
              cancel={() => setDelStep(0)}
              confirmLabel="Yes, continue"
              confirm={() => setDelStep(2)}
            />
          )}
          {mode === "view" && delStep === 2 && (
            <div className="mt-5">
              <label className="block text-xs mb-1.5" style={{ color: "var(--color-muted)" }}>
                Type <span className="num font-medium" style={{ color: "var(--color-text)" }}>{CONFIRM_PHRASE}</span> to confirm
              </label>
              <input
                autoFocus
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                className="w-full rounded-lg px-3 py-2 text-sm mb-3"
                style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
              />
              <div className="flex gap-2">
                <Btn kind="ghost" onClick={() => { setDelStep(0); setPhrase(""); }}>Cancel</Btn>
                <Btn kind="danger" disabled={busy || phrase.trim() !== CONFIRM_PHRASE} onClick={doDelete}>
                  {busy ? "Deleting…" : "Delete permanently"}
                </Btn>
              </div>
            </div>
          )}

          {/* EDIT flow — confirm yes twice */}
          {mode === "edit" && saveStep === 0 && (
            <div className="mt-5 flex gap-2">
              <Btn kind="ghost" onClick={() => { setMode("view"); setVals(Object.fromEntries(rows.map((b) => [b, String(point[b])]))); }}>
                Cancel
              </Btn>
              <Btn kind="accent" onClick={() => setSaveStep(1)}>Save changes</Btn>
            </div>
          )}
          {mode === "edit" && saveStep === 1 && (
            <Guard
              tone="accent"
              title="Save these changes?"
              body={`This overwrites the ${fmtDate(point.date)} entry. New total: ${aud(editedTotal)}.`}
              cancel={() => setSaveStep(0)}
              confirmLabel="Yes"
              confirm={() => setSaveStep(2)}
            />
          )}
          {mode === "edit" && saveStep === 2 && (
            <Guard
              tone="accent"
              title="Confirm once more"
              body="Press yes again to write these values."
              cancel={() => setSaveStep(0)}
              confirmLabel={busy ? "Saving…" : "Yes, save"}
              confirm={doSave}
              confirmDisabled={busy}
            />
          )}
        </div>
      </div>
    </Portal>
  );
}

function Guard({
  tone,
  title,
  body,
  cancel,
  confirm,
  confirmLabel,
  confirmDisabled,
}: {
  tone: "negative" | "accent";
  title: string;
  body: string;
  cancel: () => void;
  confirm: () => void;
  confirmLabel: string;
  confirmDisabled?: boolean;
}) {
  const color = tone === "negative" ? "var(--color-negative)" : "var(--color-accent)";
  return (
    <div className="mt-5 rounded-lg p-3" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
      <div className="flex items-center gap-2 text-sm font-medium mb-2" style={{ color }}>
        <AlertTriangle size={16} /> {title}
      </div>
      <div className="text-xs mb-3" style={{ color: "var(--color-muted)" }}>{body}</div>
      <div className="flex gap-2">
        <Btn kind="ghost" onClick={cancel}>Cancel</Btn>
        <Btn kind={tone === "negative" ? "danger" : "accent"} onClick={confirm} disabled={confirmDisabled}>
          {confirmLabel}
        </Btn>
      </div>
    </div>
  );
}

function Btn({
  kind,
  onClick,
  disabled,
  children,
}: {
  kind: "ghost" | "accent" | "danger";
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const style =
    kind === "ghost"
      ? { background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }
      : kind === "danger"
        ? { background: "var(--color-negative)", color: "#fff" }
        : { background: "var(--color-accent)", color: "var(--color-bg)" };
  return (
    <button onClick={onClick} disabled={disabled} className="flex-1 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-40" style={style}>
      {children}
    </button>
  );
}
