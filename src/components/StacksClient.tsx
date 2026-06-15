"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2, Check, ChevronUp, ChevronDown, Link2, ArrowDown } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import { Portal } from "@/components/Portal";
import { reorder, chainProgress } from "@/lib/stacks";

type StackItem = { habitId: string; name: string; order: number; doneToday: boolean };
export type StackDTO = { id: string; name: string; cue: string | null; items: StackItem[] };
type Ref = { id: string; name: string };

export function StacksClient({ stacks, habits, today }: { stacks: StackDTO[]; habits: Ref[]; today: string }) {
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Your routines</div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium" style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
          <Plus size={16} /> New routine
        </button>
      </div>

      {stacks.length === 0 ? (
        <EmptyState title="No routines yet" hint="Chain a few habits together, e.g. After coffee → meditate → journal." />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {stacks.map((s) => (
            <StackCard key={s.id} stack={s} habits={habits} today={today} />
          ))}
        </div>
      )}

      {adding && <StackModal stack={null} onClose={() => setAdding(false)} />}
    </div>
  );
}

function StackCard({ stack, habits, today }: { stack: StackDTO; habits: Ref[]; today: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addHabit, setAddHabit] = useState("");

  const ids = stack.items.map((i) => i.habitId);
  const available = habits.filter((h) => !ids.includes(h.id));
  const done = new Set(stack.items.filter((i) => i.doneToday).map((i) => i.habitId));
  const progress = chainProgress(stack.items, done);

  async function toggle(habitId: string, doneNow: boolean) {
    if (busy) return;
    setBusy(true);
    await fetch("/api/habits/log", {
      method: doneNow ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habitId, date: today }),
    });
    setBusy(false);
    router.refresh();
  }

  async function move(habitId: string, dir: -1 | 1) {
    const next = reorder(ids, habitId, dir);
    if (next.join() === ids.join()) return;
    setBusy(true);
    await fetch("/api/stacks/item", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stackId: stack.id, orderedHabitIds: next }) });
    setBusy(false);
    router.refresh();
  }

  async function add() {
    if (!addHabit) return;
    setBusy(true);
    await fetch("/api/stacks/item", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stackId: stack.id, habitId: addHabit }) });
    setBusy(false);
    setAddHabit("");
    router.refresh();
  }

  async function removeItem(habitId: string) {
    setBusy(true);
    await fetch("/api/stacks/item", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stackId: stack.id, habitId }) });
    setBusy(false);
    router.refresh();
  }

  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <Link2 size={15} style={{ color: "var(--color-accent)" }} />
          <button onClick={() => setEditing(true)} className="font-medium truncate text-left">{stack.name}</button>
        </div>
        <span className="num text-xs shrink-0" style={{ color: "var(--color-muted)" }}>{Math.round(progress * 100)}%</span>
      </div>
      {stack.cue && <div className="text-xs mb-3" style={{ color: "var(--color-muted)" }}>After I {stack.cue}…</div>}

      <div className="space-y-1.5 mb-3">
        {stack.items.length === 0 && <div className="text-xs" style={{ color: "var(--color-muted)" }}>No habits in this routine yet.</div>}
        {stack.items.map((it, idx) => (
          <div key={it.habitId}>
            {idx > 0 && <div className="flex justify-center" style={{ color: "var(--color-border)" }}><ArrowDown size={12} /></div>}
            <div className="flex items-center gap-2 rounded-lg p-2" style={{ background: "var(--color-surface-2)" }}>
              <button
                onClick={() => toggle(it.habitId, it.doneToday)}
                disabled={busy}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md disabled:opacity-50"
                style={{ background: it.doneToday ? "var(--color-accent)" : "transparent", border: `1px solid ${it.doneToday ? "var(--color-accent)" : "var(--color-border)"}`, color: "var(--color-bg)" }}
                aria-label={it.doneToday ? "Mark not done" : "Mark done"}
              >
                {it.doneToday && <Check size={14} />}
              </button>
              <span className={`text-sm flex-1 truncate ${it.doneToday ? "line-through opacity-60" : ""}`}>{it.name}</span>
              <button onClick={() => move(it.habitId, -1)} disabled={busy || idx === 0} className="disabled:opacity-30" style={{ color: "var(--color-muted)" }}><ChevronUp size={15} /></button>
              <button onClick={() => move(it.habitId, 1)} disabled={busy || idx === stack.items.length - 1} className="disabled:opacity-30" style={{ color: "var(--color-muted)" }}><ChevronDown size={15} /></button>
              <button onClick={() => removeItem(it.habitId)} disabled={busy} style={{ color: "var(--color-negative)" }}><X size={15} /></button>
            </div>
          </div>
        ))}
      </div>

      {available.length > 0 && (
        <div className="flex items-center gap-2">
          <select value={addHabit} onChange={(e) => setAddHabit(e.target.value)} className="flex-1 rounded-lg px-2 py-1.5 text-xs" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
            <option value="">+ add a habit…</option>
            {available.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <button onClick={add} disabled={busy || !addHabit} className="rounded-lg px-2.5 py-1.5 text-xs disabled:opacity-50" style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>Add</button>
        </div>
      )}

      {editing && <StackModal stack={stack} onClose={() => setEditing(false)} />}
    </Card>
  );
}

const inputStyle = { background: "var(--color-surface-2)", border: "1px solid var(--color-border)" } as const;

function StackModal({ stack, onClose }: { stack: StackDTO | null; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(stack?.name ?? "");
  const [cue, setCue] = useState(stack?.cue ?? "");

  async function save() {
    setBusy(true);
    await fetch("/api/stacks", { method: stack ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(stack ? { id: stack.id } : {}), name, cue }) });
    setBusy(false);
    onClose();
    router.refresh();
  }
  async function remove() {
    if (!stack) return;
    setBusy(true);
    await fetch("/api/stacks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: stack.id }) });
    setBusy(false);
    onClose();
    router.refresh();
  }

  return (
    <Portal>
      <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="anim-overlay fixed inset-0 z-50 grid place-items-center p-4 overflow-y-auto" style={{ background: "rgba(0,0,0,0.6)" }}>
        <div className="anim-pop card p-6 w-full max-w-md my-8">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold">{stack ? "Edit routine" : "New routine"}</div>
            <button onClick={onClose} style={{ color: "var(--color-muted)" }}><X size={18} /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>Routine name</label>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Morning routine" className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>Anchor cue (After I…)</label>
              <input value={cue} onChange={(e) => setCue(e.target.value)} placeholder="e.g. pour my coffee" className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-5">
            <button onClick={save} disabled={busy || name.trim() === ""} className="flex-1 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50" style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>{busy ? "Saving…" : stack ? "Save" : "Create"}</button>
            {stack && <button onClick={remove} disabled={busy} className="rounded-lg px-3 py-2 text-sm disabled:opacity-50 flex items-center gap-1.5" style={{ background: "var(--color-surface-2)", color: "var(--color-negative)" }}><Trash2 size={15} /> Delete</button>}
          </div>
        </div>
      </div>
    </Portal>
  );
}
