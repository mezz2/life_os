"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, X, Trash2, Compass, CalendarRange, LayoutGrid, Camera, Check } from "lucide-react";
import { Card, Badge, EmptyState } from "@/components/ui";
import { Portal } from "@/components/Portal";
import { DatePicker } from "@/components/DatePicker";
import { fmtDate } from "@/lib/format";
import { activeSeason, seasonProgress, weeksRemaining, seasonWeeks } from "@/lib/seasons";

export type SeasonDTO = {
  id: string;
  name: string;
  start: string; // YYYY-MM-DD
  end: string;
  theme: string | null;
  valueId: string | null;
  valueName: string | null;
  goalIds: string[];
  goalNames: string[];
};
export type TemplateDTO = { id: string; name: string; blockCount: number; weeklyMinutes: number };
type Ref = { id: string; name: string };

const inputStyle = { background: "var(--color-surface-2)", border: "1px solid var(--color-border)" } as const;

function fmtMins(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function SeasonsClient({
  today,
  seasons,
  templates,
  values,
  goals,
  liveBlockCount,
}: {
  today: string;
  seasons: SeasonDTO[];
  templates: TemplateDTO[];
  values: Ref[];
  goals: Ref[];
  liveBlockCount: number;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<SeasonDTO | null>(null);

  const active = activeSeason(seasons, today);

  return (
    <div className="space-y-6">
      {active && (
        <Card>
          <div className="flex items-center gap-2 mb-1">
            <CalendarRange size={16} style={{ color: "var(--color-accent)" }} />
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Current season</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-lg font-semibold">{active.name}</div>
            <div className="num text-xs shrink-0" style={{ color: "var(--color-muted)" }}>
              {weeksRemaining(active, today)} {weeksRemaining(active, today) === 1 ? "week" : "weeks"} left
            </div>
          </div>
          {active.theme && <div className="text-sm mt-0.5" style={{ color: "var(--color-muted)" }}>{active.theme}</div>}
          <div className="mt-3 h-1.5 w-full rounded-full overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
            <div className="h-full rounded-full" style={{ width: `${Math.round(seasonProgress(active, today) * 100)}%`, background: "var(--color-accent)" }} />
          </div>
        </Card>
      )}

      {/* Seasons */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Seasons</div>
          <button onClick={() => setAdding(true)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium" style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
            <Plus size={16} /> New season
          </button>
        </div>
        {seasons.length === 0 ? (
          <EmptyState title="No seasons yet" hint="Set a 6–12 week focus window, e.g. “Winter — base fitness & ship LifeOS”." />
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {seasons.map((s) => (
              <SeasonCard key={s.id} season={s} isActive={active?.id === s.id} today={today} onEdit={() => setEditing(s)} />
            ))}
          </div>
        )}
      </div>

      {/* Week templates */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Week templates</div>
        </div>
        <TemplatesPanel templates={templates} liveBlockCount={liveBlockCount} />
      </div>

      {adding && <SeasonModal season={null} values={values} goals={goals} onClose={() => setAdding(false)} />}
      {editing && <SeasonModal season={editing} values={values} goals={goals} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SeasonCard({ season, isActive, today, onEdit }: { season: SeasonDTO; isActive: boolean; today: string; onEdit: () => void }) {
  const upcoming = season.start > today;
  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-2 mb-1">
        <button onClick={onEdit} className="font-medium text-left truncate">{season.name}</button>
        {isActive ? <Badge tone="accent">active</Badge> : upcoming ? <Badge>upcoming</Badge> : <Badge>past</Badge>}
      </div>
      <div className="num text-xs mb-2" style={{ color: "var(--color-muted)" }}>
        {fmtDate(season.start, "med")} → {fmtDate(season.end, "med")} · {seasonWeeks(season)}wk
      </div>
      {season.theme && <div className="text-sm mb-2">{season.theme}</div>}
      <div className="flex flex-wrap gap-1.5">
        {season.valueName && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]" style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}>
            <Compass size={11} /> {season.valueName}
          </span>
        )}
        {season.goalNames.map((g) => (
          <span key={g} className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}>{g}</span>
        ))}
      </div>
    </Card>
  );
}

function TemplatesPanel({ templates, liveBlockCount }: { templates: TemplateDTO[]; liveBlockCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  async function snapshot() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, fromCurrent: true }),
    });
    setBusy(false);
    if (res.ok) {
      setNaming(false);
      setName("");
      router.refresh();
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-sm" style={{ color: "var(--color-muted)" }}>
          Save your <Link href="/shuffle" className="underline" style={{ color: "var(--color-accent)" }}>flexible blocks</Link> as a reusable default week, then apply it whenever you reset.
        </div>
      </div>

      {naming ? (
        <div className="flex items-center gap-2 mb-3">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") snapshot(); if (e.key === "Escape") setNaming(false); }}
            placeholder="Template name, e.g. Default week"
            className="flex-1 rounded-lg px-3 py-2 text-sm"
            style={inputStyle}
          />
          <button onClick={snapshot} disabled={busy || !name.trim()} className="rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50" style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>{busy ? "Saving…" : "Save"}</button>
          <button onClick={() => setNaming(false)} className="rounded-lg px-2.5 py-2" style={{ color: "var(--color-muted)" }}><X size={16} /></button>
        </div>
      ) : (
        <button
          onClick={() => setNaming(true)}
          disabled={liveBlockCount === 0}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium mb-3 disabled:opacity-50"
          style={{ background: "var(--color-surface-2)" }}
          title={liveBlockCount === 0 ? "Add some flexible blocks on the Shuffle page first" : undefined}
        >
          <Camera size={15} /> Save current week as template
          <span className="num text-xs" style={{ color: "var(--color-muted)" }}>({liveBlockCount} {liveBlockCount === 1 ? "block" : "blocks"})</span>
        </button>
      )}

      {templates.length === 0 ? (
        <EmptyState title="No templates yet" hint="Build a week of blocks on Shuffle, then snapshot it here." />
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <TemplateRow key={t.id} tpl={t} liveBlockCount={liveBlockCount} />
          ))}
        </div>
      )}
    </Card>
  );
}

function TemplateRow({ tpl, liveBlockCount }: { tpl: TemplateDTO; liveBlockCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [done, setDone] = useState(false);

  async function apply(mode: "append" | "replace") {
    setBusy(true);
    const res = await fetch("/api/templates/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: tpl.id, mode }),
    });
    setBusy(false);
    setConfirmReplace(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => setDone(false), 2500);
      router.refresh();
    }
  }

  async function remove() {
    setBusy(true);
    await fetch("/api/templates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: tpl.id }) });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2 rounded-lg p-3" style={{ background: "var(--color-surface-2)" }}>
      <LayoutGrid size={15} style={{ color: "var(--color-accent)" }} />
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm truncate">{tpl.name}</div>
        <div className="num text-xs" style={{ color: "var(--color-muted)" }}>{tpl.blockCount} {tpl.blockCount === 1 ? "block" : "blocks"} · {fmtMins(tpl.weeklyMinutes)}/wk</div>
      </div>
      {done ? (
        <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-accent)" }}><Check size={14} /> Applied</span>
      ) : confirmReplace ? (
        <div className="flex items-center gap-1.5">
          <span className="text-[11px]" style={{ color: "var(--color-warn)" }}>Replace all {liveBlockCount}?</span>
          <button onClick={() => apply("replace")} disabled={busy} className="rounded-md px-2 py-1 text-xs font-medium" style={{ background: "var(--color-negative)", color: "var(--color-bg)" }}>Replace</button>
          <button onClick={() => setConfirmReplace(false)} className="rounded-md px-2 py-1 text-xs" style={{ color: "var(--color-muted)" }}>Cancel</button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <button onClick={() => apply("append")} disabled={busy} className="rounded-md px-2.5 py-1.5 text-xs font-medium disabled:opacity-50" style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>Apply</button>
          <button onClick={() => setConfirmReplace(true)} disabled={busy || liveBlockCount === 0} className="rounded-md px-2.5 py-1.5 text-xs disabled:opacity-40" style={{ background: "var(--color-bg)" }} title="Clear current blocks, then apply">Replace</button>
          <button onClick={remove} disabled={busy} style={{ color: "var(--color-negative)" }}><Trash2 size={15} /></button>
        </div>
      )}
    </div>
  );
}

function SeasonModal({ season, values, goals, onClose }: { season: SeasonDTO | null; values: Ref[]; goals: Ref[]; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(season?.name ?? "");
  const [start, setStart] = useState(season?.start ?? "");
  const [end, setEnd] = useState(season?.end ?? "");
  const [theme, setTheme] = useState(season?.theme ?? "");
  const [valueId, setValueId] = useState(season?.valueId ?? "");
  const [goalIds, setGoalIds] = useState<string[]>(season?.goalIds ?? []);

  const toggleGoal = (id: string) => setGoalIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const valid = name.trim() !== "" && start !== "" && end !== "" && end >= start;

  async function save() {
    setBusy(true);
    const res = await fetch("/api/seasons", {
      method: season ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(season ? { id: season.id } : {}), name, start, end, theme, valueId: valueId || null, goalIds }),
    });
    setBusy(false);
    if (res.ok) { onClose(); router.refresh(); }
  }

  async function remove() {
    if (!season) return;
    setBusy(true);
    await fetch("/api/seasons", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: season.id }) });
    setBusy(false);
    onClose();
    router.refresh();
  }

  return (
    <Portal>
      <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="anim-overlay fixed inset-0 z-50 grid place-items-center p-4 overflow-y-auto" style={{ background: "rgba(0,0,0,0.6)" }}>
        <div className="anim-pop card p-6 w-full max-w-md my-8">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold">{season ? "Edit season" : "New season"}</div>
            <button onClick={onClose} style={{ color: "var(--color-muted)" }}><X size={18} /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>Name</label>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Winter base-building" className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>Start</label>
                <DatePicker value={start} onChange={setStart} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>End</label>
                <DatePicker value={end} onChange={setEnd} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
              </div>
            </div>
            {start !== "" && end !== "" && end < start && (
              <div className="text-xs" style={{ color: "var(--color-negative)" }}>End must be on or after the start.</div>
            )}
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>Theme / focus</label>
              <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g. Build the habit base; ship LifeOS" className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
            </div>
            {values.length > 0 && (
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>Anchor value</label>
                <select value={valueId} onChange={(e) => setValueId(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                  <option value="">— none —</option>
                  {values.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            )}
            {goals.length > 0 && (
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>Goals in focus</label>
                <div className="flex flex-wrap gap-1.5">
                  {goals.map((g) => {
                    const on = goalIds.includes(g.id);
                    return (
                      <button key={g.id} type="button" onClick={() => toggleGoal(g.id)} className="rounded-full px-2.5 py-1 text-xs transition-colors" style={{ background: on ? "var(--color-accent-dim)" : "var(--color-surface-2)", border: `1px solid ${on ? "var(--color-accent)" : "var(--color-border)"}`, color: on ? "var(--color-accent)" : "var(--color-muted)" }}>
                        {g.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-5">
            <button onClick={save} disabled={busy || !valid} className="flex-1 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50" style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>{busy ? "Saving…" : season ? "Save changes" : "Create season"}</button>
            {season && <button onClick={remove} disabled={busy} className="rounded-lg px-3 py-2 text-sm disabled:opacity-50 flex items-center gap-1.5" style={{ background: "var(--color-surface-2)", color: "var(--color-negative)" }}><Trash2 size={15} /> Delete</button>}
          </div>
        </div>
      </div>
    </Portal>
  );
}
