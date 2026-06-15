"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, X, Trash2, Shuffle, Check, AlertTriangle, Undo2, CalendarDays } from "lucide-react";
import { Card, Badge, EmptyState } from "@/components/ui";
import { Portal } from "@/components/Portal";
import { formatMinutes } from "@/lib/calendar";

export type TimeBlockDTO = {
  id: string;
  title: string;
  rigidity: string;
  durationMin: number;
  minChunkMin: number;
  energy: string;
  days: string | null;
  startMin: number;
  endMin: number;
  priority: number;
  habitId: string | null;
};

type Ref = { id: string; name: string };
type Placement = { blockId: string; title: string; dayKey: string; startMin: number; endMin: number };
type Unplaced = { blockId: string; title: string; remainingMin: number; reason: string };
type Proposal = { placements: Placement[]; unplaced: Unplaced[] };

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hhmm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ap = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? ":" + String(m).padStart(2, "0") : ""}${ap}`;
}

function dowOf(key: string): number {
  return new Date(key + "T00:00:00.000Z").getUTCDay();
}

export function ShuffleClient({
  weekStart,
  blocks,
  habits,
}: {
  weekStart: string;
  blocks: TimeBlockDTO[];
  habits: Ref[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<TimeBlockDTO | null>(null);
  const [adding, setAdding] = useState(false);
  const [demandText, setDemandText] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [demandNote, setDemandNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<{ batch: string; count: number } | null>(null);

  async function propose() {
    setBusy(true);
    setApplied(null);
    const res = await fetch("/api/shuffle/propose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart, demandText }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) {
      setProposal(j.proposal);
      setDemandNote(j.demandNote ?? null);
    }
  }

  async function apply() {
    if (!proposal) return;
    setBusy(true);
    const res = await fetch("/api/shuffle/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placements: proposal.placements }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) {
      setApplied({ batch: j.batch, count: j.count });
      router.refresh();
    }
  }

  async function undo() {
    setBusy(true);
    await fetch("/api/shuffle/undo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(applied ? { batch: applied.batch } : {}),
    });
    setBusy(false);
    setApplied(null);
    setProposal(null);
    router.refresh();
  }

  const byDay = new Map<string, Placement[]>();
  for (const p of proposal?.placements ?? []) {
    if (!byDay.has(p.dayKey)) byDay.set(p.dayKey, []);
    byDay.get(p.dayKey)!.push(p);
  }
  const dayKeys = [...byDay.keys()].sort();

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      {/* Left: blocks + demand */}
      <div className="space-y-5">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Flexible blocks</span>
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium"
              style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
            >
              <Plus size={14} /> Add block
            </button>
          </div>
          {blocks.length === 0 ? (
            <EmptyState title="No blocks yet" hint="Add a flexible/elastic/fluid block to reflow each week." />
          ) : (
            <div className="space-y-2">
              {blocks.map((b) => (
                <button key={b.id} onClick={() => setEditing(b)} className="w-full text-left card p-3 transition-colors hover:border-[var(--color-accent)]">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{b.title}</span>
                    {b.habitId && <Badge tone="accent">habit</Badge>}
                    <Badge>{b.rigidity}</Badge>
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
                    {formatMinutes(b.durationMin)} · {b.energy} energy · {hhmm(b.startMin)}–{hhmm(b.endMin)}
                    {b.days ? ` · ${b.days.split(",").map((d) => DAY_LABELS[Number(d)]).join(",")}` : " · any day"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="text-sm font-medium mb-2">This week&apos;s demands</div>
          <textarea
            value={demandText}
            onChange={(e) => setDemandText(e.target.value)}
            rows={3}
            placeholder="e.g. Crazy work week, big deadline Thursday, dinner Friday — protect Sunday and drop the nice-to-haves."
            className="w-full rounded-lg px-3 py-2 text-sm resize-none"
            style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
          />
          <button
            onClick={propose}
            disabled={busy || blocks.length === 0}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
          >
            <Shuffle size={16} /> {busy ? "Thinking…" : "Propose a week"}
          </button>
          {demandNote && (
            <p className="text-[11px] mt-2" style={{ color: "var(--color-muted)" }}>{demandNote}</p>
          )}
        </Card>
      </div>

      {/* Right: proposal */}
      <div>
        {!proposal ? (
          <EmptyState title="No proposal yet" hint="Add blocks, then “Propose a week” to see a reflowed schedule." />
        ) : (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Proposed week</span>
              <span className="text-xs num" style={{ color: "var(--color-muted)" }}>
                {proposal.placements.length} placed · {proposal.unplaced.length} unplaced
              </span>
            </div>

            {applied ? (
              <div className="rounded-lg p-3 mb-3" style={{ background: "var(--color-accent-dim)", border: "1px solid var(--color-accent)" }}>
                <div className="flex items-center gap-2 text-sm" style={{ color: "var(--color-accent)" }}>
                  <Check size={16} /> Applied {applied.count} blocks to your calendar
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Link href="/calendar" className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs" style={{ background: "var(--color-surface-2)" }}>
                    <CalendarDays size={13} /> View on calendar
                  </Link>
                  <button onClick={undo} disabled={busy} className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs" style={{ background: "var(--color-surface-2)", color: "var(--color-negative)" }}>
                    <Undo2 size={13} /> Undo
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-3">
                <button onClick={apply} disabled={busy || proposal.placements.length === 0} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50" style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
                  <Check size={15} /> Apply to calendar
                </button>
                <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>Nothing is written until you apply.</span>
              </div>
            )}

            <div className="space-y-3">
              {dayKeys.map((dk) => (
                <div key={dk}>
                  <div className="text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>
                    {DAY_LABELS[dowOf(dk)]} {dk.slice(8)}
                  </div>
                  <div className="space-y-1">
                    {byDay.get(dk)!.map((p, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm" style={{ background: "var(--color-surface-2)", borderLeft: "3px solid var(--color-accent)" }}>
                        <span className="truncate">{p.title}</span>
                        <span className="num text-xs shrink-0 ml-2" style={{ color: "var(--color-muted)" }}>
                          {hhmm(p.startMin)}–{hhmm(p.endMin)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {proposal.unplaced.length > 0 && (
              <div className="mt-4 pt-3 border-t">
                <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: "var(--color-warn)" }}>
                  <AlertTriangle size={14} /> Couldn&apos;t fit — you&apos;re overcommitted this week
                </div>
                <div className="space-y-1">
                  {proposal.unplaced.map((u, i) => (
                    <div key={i} className="text-xs" style={{ color: "var(--color-muted)" }}>
                      <span style={{ color: "var(--color-text)" }}>{u.title}</span> — {u.reason}
                      {u.remainingMin > 0 ? ` (${formatMinutes(u.remainingMin)} left)` : ""}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      {editing && <BlockModal block={editing} habits={habits} onClose={() => setEditing(null)} />}
      {adding && <BlockModal block={null} habits={habits} onClose={() => setAdding(false)} />}
    </div>
  );
}

const inputStyle = { background: "var(--color-surface-2)", border: "1px solid var(--color-border)" } as const;
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>{label}</label>
      {children}
    </div>
  );
}

function BlockModal({ block, habits, onClose }: { block: TimeBlockDTO | null; habits: Ref[]; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    title: block?.title ?? "",
    rigidity: block?.rigidity ?? "flexible",
    durationMin: block ? String(block.durationMin) : "60",
    minChunkMin: block ? String(block.minChunkMin) : "30",
    energy: block?.energy ?? "any",
    startMin: block ? String(block.startMin) : "360",
    endMin: block ? String(block.endMin) : "1320",
    habitId: block?.habitId ?? "",
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const [days, setDays] = useState<number[]>(
    (block?.days ?? "").split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n)),
  );
  const toggleDay = (d: number) => setDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));

  async function save() {
    setSaving(true);
    const payload = {
      ...(block ? { id: block.id } : {}),
      title: f.title,
      rigidity: f.rigidity,
      durationMin: Number(f.durationMin) || 60,
      minChunkMin: Number(f.minChunkMin) || 30,
      energy: f.energy,
      days,
      startMin: Number(f.startMin),
      endMin: Number(f.endMin),
      habitId: f.habitId || null,
    };
    const res = await fetch("/api/timeblocks", {
      method: block ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) { onClose(); router.refresh(); }
  }

  async function remove() {
    if (!block) return;
    setSaving(true);
    await fetch("/api/timeblocks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: block.id }) });
    setSaving(false);
    onClose();
    router.refresh();
  }

  const hours = Array.from({ length: 25 }, (_, i) => i * 60);

  return (
    <Portal>
      <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="anim-overlay fixed inset-0 z-50 grid place-items-center p-4 overflow-y-auto" style={{ background: "rgba(0,0,0,0.6)" }}>
        <div className="anim-pop card p-6 w-full max-w-md my-8">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold">{block ? "Edit block" : "New block"}</div>
            <button onClick={onClose} style={{ color: "var(--color-muted)" }}><X size={18} /></button>
          </div>
          <div className="space-y-3">
            <Field label="Block"><input autoFocus value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Deep work" className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Flexibility">
                <select value={f.rigidity} onChange={(e) => set("rigidity", e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                  <option value="flexible">Flexible (one slot)</option>
                  <option value="elastic">Elastic (can split)</option>
                  <option value="fluid">Fluid (drop if full)</option>
                </select>
              </Field>
              <Field label="Energy">
                <select value={f.energy} onChange={(e) => set("energy", e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                  <option value="any">Any</option>
                  <option value="high">High (mornings)</option>
                  <option value="low">Low (later)</option>
                </select>
              </Field>
              <Field label="Total minutes"><input type="number" min={5} value={f.durationMin} onChange={(e) => set("durationMin", e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm num" style={inputStyle} /></Field>
              {f.rigidity === "elastic" && <Field label="Min chunk (min)"><input type="number" min={5} value={f.minChunkMin} onChange={(e) => set("minChunkMin", e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm num" style={inputStyle} /></Field>}
              <Field label="Earliest">
                <select value={f.startMin} onChange={(e) => set("startMin", e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                  {hours.map((h) => <option key={h} value={h}>{hhmm(h)}</option>)}
                </select>
              </Field>
              <Field label="Latest">
                <select value={f.endMin} onChange={(e) => set("endMin", e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                  {hours.map((h) => <option key={h} value={h}>{hhmm(h)}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Allowed days (none = any)">
              <div className="flex gap-1.5">
                {WEEKDAY_ORDER.map((d) => {
                  const on = days.includes(d);
                  return <button key={d} type="button" onClick={() => toggleDay(d)} className="flex-1 rounded-lg py-1.5 text-xs transition-colors" style={{ background: on ? "var(--color-accent-dim)" : "var(--color-surface-2)", border: `1px solid ${on ? "var(--color-accent)" : "var(--color-border)"}`, color: on ? "var(--color-accent)" : "var(--color-muted)" }}>{DAY_LABELS[d][0]}</button>;
                })}
              </div>
            </Field>
            {habits.length > 0 && (
              <Field label="Protect time for habit (optional)">
                <select value={f.habitId} onChange={(e) => set("habitId", e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                  <option value="">— not a habit block —</option>
                  {habits.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </Field>
            )}
          </div>
          <div className="flex items-center gap-2 mt-5">
            <button onClick={save} disabled={saving || f.title.trim() === ""} className="flex-1 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50" style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>{saving ? "Saving…" : block ? "Save changes" : "Create block"}</button>
            {block && <button onClick={remove} disabled={saving} className="rounded-lg px-3 py-2 text-sm disabled:opacity-50 flex items-center gap-1.5" style={{ background: "var(--color-surface-2)", color: "var(--color-negative)" }}><Trash2 size={15} /> Delete</button>}
          </div>
        </div>
      </div>
    </Portal>
  );
}
