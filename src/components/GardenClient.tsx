"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2, ExternalLink, BookOpen, Compass, Target } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import { Portal } from "@/components/Portal";
import { groupBySource, hostOf } from "@/lib/references";

export type ReferenceDTO = {
  id: string;
  title: string;
  url: string | null;
  source: string | null;
  note: string | null;
  valueId: string | null;
  valueName: string | null;
  goalId: string | null;
  goalName: string | null;
};
type Ref = { id: string; name: string };

const inputStyle = { background: "var(--color-surface-2)", border: "1px solid var(--color-border)" } as const;

export function GardenClient({ references, values, goals }: { references: ReferenceDTO[]; values: Ref[]; goals: Ref[] }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ReferenceDTO | null>(null);

  const groups = groupBySource(references);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
          {references.length} {references.length === 1 ? "reference" : "references"}
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium" style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
          <Plus size={16} /> Add reference
        </button>
      </div>

      {references.length === 0 ? (
        <EmptyState title="Your garden is empty" hint="Save an article, talk or paper and tag it to a value or goal." />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.source}>
              <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--color-muted)" }}>{g.source}</div>
              <div className="grid md:grid-cols-2 gap-3">
                {g.items.map((r) => (
                  <RefCard key={r.id} reference={r} onEdit={() => setEditing(r)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && <RefModal reference={null} values={values} goals={goals} onClose={() => setAdding(false)} />}
      {editing && <RefModal reference={editing} values={values} goals={goals} onClose={() => setEditing(null)} />}
    </div>
  );
}

function RefCard({ reference, onEdit }: { reference: ReferenceDTO; onEdit: () => void }) {
  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen size={15} className="shrink-0" style={{ color: "var(--color-accent)" }} />
          <button onClick={onEdit} className="font-medium text-left truncate">{reference.title}</button>
        </div>
        {reference.url && (
          <a href={reference.url} target="_blank" rel="noopener noreferrer" className="shrink-0" style={{ color: "var(--color-muted)" }} aria-label="Open link">
            <ExternalLink size={15} />
          </a>
        )}
      </div>
      {reference.url && <div className="text-xs truncate mb-2" style={{ color: "var(--color-muted)" }}>{hostOf(reference.url)}</div>}
      {reference.note && <div className="text-sm mb-2" style={{ color: "var(--color-muted)" }}>{reference.note}</div>}
      <div className="flex flex-wrap gap-1.5">
        {reference.valueName && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]" style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}>
            <Compass size={11} /> {reference.valueName}
          </span>
        )}
        {reference.goalName && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]" style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}>
            <Target size={11} /> {reference.goalName}
          </span>
        )}
      </div>
    </Card>
  );
}

function RefModal({ reference, values, goals, onClose }: { reference: ReferenceDTO | null; values: Ref[]; goals: Ref[]; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(reference?.title ?? "");
  const [url, setUrl] = useState(reference?.url ?? "");
  const [note, setNote] = useState(reference?.note ?? "");
  const [valueId, setValueId] = useState(reference?.valueId ?? "");
  const [goalId, setGoalId] = useState(reference?.goalId ?? "");

  async function save() {
    setBusy(true);
    const res = await fetch("/api/references", {
      method: reference ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(reference ? { id: reference.id } : {}), title, url, note, valueId: valueId || null, goalId: goalId || null }),
    });
    setBusy(false);
    if (res.ok) { onClose(); router.refresh(); }
  }

  async function remove() {
    if (!reference) return;
    setBusy(true);
    await fetch("/api/references", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: reference.id }) });
    setBusy(false);
    onClose();
    router.refresh();
  }

  return (
    <Portal>
      <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="anim-overlay fixed inset-0 z-50 grid place-items-center p-4 overflow-y-auto" style={{ background: "rgba(0,0,0,0.6)" }}>
        <div className="anim-pop card p-6 w-full max-w-md my-8">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold">{reference ? "Edit reference" : "Add reference"}</div>
            <button onClick={onClose} style={{ color: "var(--color-muted)" }}><X size={18} /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>Title</label>
              <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Atomic Habits — summary" className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>Link (optional)</label>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>Note (optional)</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Why it matters / the one takeaway" className="w-full rounded-lg px-3 py-2 text-sm resize-none" style={inputStyle} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>Value</label>
                <select value={valueId} onChange={(e) => setValueId(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                  <option value="">— none —</option>
                  {values.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>Goal</label>
                <select value={goalId} onChange={(e) => setGoalId(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                  <option value="">— none —</option>
                  {goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-5">
            <button onClick={save} disabled={busy || title.trim() === ""} className="flex-1 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50" style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>{busy ? "Saving…" : reference ? "Save changes" : "Add"}</button>
            {reference && <button onClick={remove} disabled={busy} className="rounded-lg px-3 py-2 text-sm disabled:opacity-50 flex items-center gap-1.5" style={{ background: "var(--color-surface-2)", color: "var(--color-negative)" }}><Trash2 size={15} /> Delete</button>}
          </div>
        </div>
      </div>
    </Portal>
  );
}
