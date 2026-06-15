"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2, Compass, Target, Repeat } from "lucide-react";
import { Card, Badge, EmptyState } from "@/components/ui";
import { Portal } from "@/components/Portal";
import { pct } from "@/lib/format";

export type ValueDTO = {
  id: string;
  name: string;
  description: string | null;
  alignment: number | null; // 0..1 mean completion rate of linked habits, or null
  habitCount: number;
  goalCount: number;
  habits: { id: string; name: string }[];
  goals: { id: string; name: string }[];
};

function alignmentTone(a: number): "positive" | "warn" | "negative" {
  if (a >= 0.7) return "positive";
  if (a >= 0.4) return "warn";
  return "negative";
}

export function ValuesClient({ values }: { values: ValueDTO[] }) {
  const [editing, setEditing] = useState<ValueDTO | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
          Core values
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        >
          <Plus size={16} /> Add value
        </button>
      </div>

      {values.length === 0 ? (
        <EmptyState
          title="No values yet"
          hint="Define what you're optimising for, then link goals and habits to each."
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {values.map((v) => (
            <ValueCard key={v.id} v={v} onClick={() => setEditing(v)} />
          ))}
        </div>
      )}

      {editing && <ValueModal value={editing} onClose={() => setEditing(null)} />}
      {adding && <ValueModal value={null} onClose={() => setAdding(false)} />}
    </div>
  );
}

function ValueCard({ v, onClick }: { v: ValueDTO; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left">
      <Card className="h-full transition-colors hover:border-[var(--color-accent)]">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Compass size={16} style={{ color: "var(--color-accent)" }} />
            <span className="font-medium truncate">{v.name}</span>
          </div>
          {v.alignment != null ? (
            <Badge tone={alignmentTone(v.alignment)}>{pct(v.alignment)} aligned</Badge>
          ) : (
            <Badge>unmeasured</Badge>
          )}
        </div>
        {v.description && (
          <div className="text-xs mb-3" style={{ color: "var(--color-muted)" }}>
            {v.description}
          </div>
        )}

        {v.alignment != null && (
          <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: "var(--color-surface-2)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${v.alignment * 100}%`, background: "var(--color-accent)" }}
            />
          </div>
        )}

        <div className="flex items-center gap-3 text-xs" style={{ color: "var(--color-muted)" }}>
          <span className="flex items-center gap-1">
            <Target size={13} /> {v.goalCount} goal{v.goalCount === 1 ? "" : "s"}
          </span>
          <span className="flex items-center gap-1">
            <Repeat size={13} /> {v.habitCount} habit{v.habitCount === 1 ? "" : "s"}
          </span>
        </div>
        {(v.habits.length > 0 || v.goals.length > 0) && (
          <div className="text-[11px] mt-2 truncate" style={{ color: "var(--color-muted)" }}>
            {[...v.goals.map((g) => g.name), ...v.habits.map((h) => h.name)].join(" · ")}
          </div>
        )}
      </Card>
    </button>
  );
}

const inputStyle = { background: "var(--color-surface-2)", border: "1px solid var(--color-border)" } as const;

function ValueModal({ value, onClose }: { value: ValueDTO | null; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState(value?.name ?? "");
  const [description, setDescription] = useState(value?.description ?? "");

  async function save() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/values", {
      method: value ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(value ? { id: value.id } : {}), name, description }),
    });
    setBusy(false);
    if (res.ok) {
      onClose();
      router.refresh();
    } else {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(j.error ?? "Something went wrong");
    }
  }

  async function remove() {
    if (!value) return;
    setBusy(true);
    await fetch("/api/values", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: value.id }),
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
            <div className="font-semibold">{value ? "Edit value" : "New value"}</div>
            <button onClick={onClose} style={{ color: "var(--color-muted)" }}>
              <X size={18} />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>Value</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Health, Craft, Financial discipline"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>What it means to you</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                style={inputStyle}
              />
            </div>
            {value && (value.goalCount > 0 || value.habitCount > 0) && (
              <p className="text-[10px]" style={{ color: "var(--color-muted)" }}>
                Deleting unlinks its {value.goalCount} goal(s) and {value.habitCount} habit(s) — they aren&apos;t removed.
              </p>
            )}
            {err && (
              <p className="text-xs" style={{ color: "var(--color-negative)" }}>{err}</p>
            )}
          </div>

          <div className="flex items-center gap-2 mt-5">
            <button
              onClick={save}
              disabled={busy || name.trim() === ""}
              className="flex-1 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
            >
              {busy ? "Saving…" : value ? "Save changes" : "Create value"}
            </button>
            {value && (
              <button
                onClick={remove}
                disabled={busy}
                title="Delete value"
                className="rounded-lg px-3 py-2 text-sm disabled:opacity-50 flex items-center gap-1.5"
                style={{ background: "var(--color-surface-2)", color: "var(--color-negative)" }}
              >
                <Trash2 size={15} /> Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
