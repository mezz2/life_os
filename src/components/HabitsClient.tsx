"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2, Check, Flame, AlertTriangle, Vote, Shield, ShieldX, Gift } from "lucide-react";
import { Card, Badge, EmptyState } from "@/components/ui";
import { Portal } from "@/components/Portal";
import { pct } from "@/lib/format";
import { addDaysKey } from "@/lib/habits";

export type HabitLogDTO = { date: string; status: string };
export type Ref = { id: string; name: string };
export type VotesDTO = { total: number; byValue: { valueId: string; name: string; votes: number; habitCount: number }[] };

export type HabitDTO = {
  id: string;
  name: string;
  identityStatement: string | null;
  type: string; // build | break
  cadence: string; // daily | weekly_count | weekdays
  targetCount: number | null;
  weekdays: string | null; // CSV of 0-6
  cue: string | null;
  craving: string | null;
  response: string | null;
  reward: string | null;
  twoMinVersion: string | null;
  rewardBundle: string | null; // temptation-bundling link surfaced at check-off
  goalId: string | null;
  valueId: string | null;
  logs: HabitLogDTO[];
  scheduledToday: boolean;
  doneToday: boolean;
  streak: number;
  completionRate: number;
  missTwice: boolean;
  weekly: { done: number; target: number } | null;
  breakClean: string; // formatted "time since last slip"
  breakEverSlipped: boolean;
  breakResistRate: number;
  breakUrges: number;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Display order for the weekday picker (Monday-first); values are 0=Sun..6=Sat.
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function cadenceLabel(h: { cadence: string; targetCount: number | null; weekdays: string | null }): string {
  if (h.cadence === "weekly_count") return `${h.targetCount ?? 1}× / week`;
  if (h.cadence === "weekdays") {
    const days = (h.weekdays ?? "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n));
    if (days.length === 0) return "Daily";
    if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return "Weekdays";
    return WEEKDAY_ORDER.filter((d) => days.includes(d)).map((d) => DAY_LABELS[d]).join(", ");
  }
  return "Daily";
}

export function HabitsClient({
  habits,
  today,
  historyDays,
  votes,
  values,
  goals,
}: {
  habits: HabitDTO[];
  today: string;
  historyDays: number;
  votes: VotesDTO;
  values: Ref[];
  goals: Ref[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<HabitDTO | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const buildHabits = habits.filter((h) => h.type !== "break");
  const breakHabits = habits.filter((h) => h.type === "break");
  const due = buildHabits.filter((h) => h.scheduledToday);
  const doneCount = due.filter((h) => h.doneToday).length;

  async function toggle(h: HabitDTO) {
    if (pending) return;
    setPending(h.id);
    await fetch("/api/habits/log", {
      method: h.doneToday ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habitId: h.id, date: today }),
    });
    setPending(null);
    router.refresh();
  }

  return (
    <div>
      {votes.total > 0 && <VotesBanner votes={votes} />}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
          Today · {doneCount}/{due.length} done
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        >
          <Plus size={16} /> Add habit
        </button>
      </div>

      {due.length === 0 ? (
        <EmptyState
          title="Nothing due today"
          hint={habits.length === 0 ? "Click “Add habit” to define your first one." : "Enjoy the breather."}
        />
      ) : (
        <div className="space-y-2 mb-8">
          {due.map((h) => (
            <TodayRow
              key={h.id}
              h={h}
              busy={pending === h.id}
              onToggle={() => toggle(h)}
              onEdit={() => setEditing(h)}
            />
          ))}
        </div>
      )}

      <div className="text-xs uppercase tracking-wide mb-3" style={{ color: "var(--color-muted)" }}>
        All habits
      </div>
      {buildHabits.length === 0 ? (
        <EmptyState title="No habits yet" />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {buildHabits.map((h) => (
            <HabitCard key={h.id} h={h} today={today} historyDays={historyDays} onClick={() => setEditing(h)} />
          ))}
        </div>
      )}

      {breakHabits.length > 0 && (
        <>
          <div className="text-xs uppercase tracking-wide mb-3 mt-8" style={{ color: "var(--color-muted)" }}>
            Breaking
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {breakHabits.map((h) => (
              <BreakCard key={h.id} h={h} onEdit={() => setEditing(h)} />
            ))}
          </div>
        </>
      )}

      {editing && <HabitModal habit={editing} values={values} goals={goals} onClose={() => setEditing(null)} />}
      {adding && <HabitModal habit={null} values={values} goals={goals} onClose={() => setAdding(false)} />}
    </div>
  );
}

// "Identity votes" this week — reframes completions as votes for who you're
// becoming (Atomic Habits). Only shows once there's at least one vote.
function VotesBanner({ votes }: { votes: VotesDTO }) {
  return (
    <Card className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <Vote size={16} style={{ color: "var(--color-accent)" }} />
        <span className="text-sm font-medium">
          <span className="num" style={{ color: "var(--color-accent)" }}>{votes.total}</span> vote
          {votes.total === 1 ? "" : "s"} cast this week for who you&apos;re becoming
        </span>
      </div>
      {votes.byValue.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {votes.byValue.map((v) => (
            <span
              key={v.valueId}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
              style={{ background: "var(--color-surface-2)" }}
            >
              {v.name}
              <span className="num font-semibold" style={{ color: "var(--color-accent)" }}>{v.votes}</span>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

function TodayRow({
  h,
  busy,
  onToggle,
  onEdit,
}: {
  h: HabitDTO;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const done = h.doneToday;
  return (
    <div
      onClick={onEdit}
      className="card flex items-center gap-3 p-3 cursor-pointer transition-colors hover:border-[var(--color-accent)]"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        disabled={busy}
        aria-label={done ? "Mark not done" : "Mark done"}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors disabled:opacity-50"
        style={{
          background: done ? "var(--color-accent)" : "var(--color-surface-2)",
          border: `1px solid ${done ? "var(--color-accent)" : "var(--color-border)"}`,
          color: done ? "var(--color-bg)" : "var(--color-muted)",
        }}
      >
        {done && <Check size={18} />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`font-medium truncate ${done ? "line-through opacity-60" : ""}`}>{h.name}</span>
          {h.type === "break" && <Badge tone="warn">break</Badge>}
        </div>
        {h.identityStatement && (
          <div className="text-xs mt-0.5 truncate" style={{ color: "var(--color-muted)" }}>
            {h.identityStatement}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {h.rewardBundle && (
          <a
            href={h.rewardBundle}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Your paired reward — enjoy it while you do this"
            className="grid h-7 w-7 place-items-center rounded-lg"
            style={{ background: "var(--color-surface-2)", color: "var(--color-accent)" }}
            aria-label="Open paired reward"
          >
            <Gift size={14} />
          </a>
        )}
        {h.weekly && (
          <span className="num text-xs" style={{ color: "var(--color-muted)" }}>
            {h.weekly.done}/{h.weekly.target}
          </span>
        )}
        {h.missTwice && !done && (
          <span title="Missed twice — don't break the chain" style={{ color: "var(--color-warn)" }}>
            <AlertTriangle size={15} />
          </span>
        )}
        {h.streak > 0 && (
          <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-accent)" }}>
            <Flame size={14} /> <span className="num">{h.streak}</span>
          </span>
        )}
      </div>
    </div>
  );
}

// Break habits invert the build loop: a "time since last slip" counter plus
// resist/slip logging instead of a daily check-off.
function BreakCard({ h, onEdit }: { h: HabitDTO; onEdit: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function log(gaveIn: boolean) {
    if (busy) return;
    setBusy(true);
    await fetch("/api/habits/urge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habitId: h.id, gaveIn }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-3 mb-3">
        <button onClick={onEdit} className="text-left min-w-0">
          <div className="font-medium truncate">{h.name}</div>
          {h.identityStatement && (
            <div className="text-xs mt-0.5 truncate" style={{ color: "var(--color-muted)" }}>{h.identityStatement}</div>
          )}
        </button>
        <Badge tone="warn">breaking</Badge>
      </div>

      <div className="flex items-end gap-2 mb-3">
        <span className="num text-2xl font-semibold" style={{ color: "var(--color-accent)" }}>{h.breakClean}</span>
        <span className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>
          {h.breakEverSlipped ? "since last slip" : "clean since day one"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => log(false)}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        >
          <Shield size={15} /> Resisted
        </button>
        <button
          onClick={() => log(true)}
          disabled={busy}
          className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
          style={{ background: "var(--color-surface-2)", color: "var(--color-negative)" }}
        >
          <ShieldX size={15} /> Slipped
        </button>
      </div>

      {h.breakUrges > 0 && (
        <div className="text-xs mt-3" style={{ color: "var(--color-muted)" }}>
          <span className="num font-medium" style={{ color: "var(--color-text)" }}>{pct(h.breakResistRate)}</span> of {h.breakUrges} urge{h.breakUrges === 1 ? "" : "s"} resisted
        </div>
      )}
    </Card>
  );
}

function HabitCard({
  h,
  today,
  historyDays,
  onClick,
}: {
  h: HabitDTO;
  today: string;
  historyDays: number;
  onClick: () => void;
}) {
  const streakUnit = h.cadence === "weekly_count" ? "wk" : "day";
  return (
    <button onClick={onClick} className="text-left">
      <Card className="h-full transition-colors hover:border-[var(--color-accent)]">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <div className="font-medium truncate">{h.name}</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
              {cadenceLabel(h)}
              {h.type === "break" ? " · breaking" : ""}
            </div>
          </div>
          <span className="flex items-center gap-1 text-sm shrink-0" style={{ color: "var(--color-accent)" }}>
            <Flame size={15} />
            <span className="num font-semibold">{h.streak}</span>
            <span className="text-xs" style={{ color: "var(--color-muted)" }}>
              {streakUnit}
              {h.streak === 1 ? "" : "s"}
            </span>
          </span>
        </div>

        <Heatmap logs={h.logs} today={today} historyDays={historyDays} />

        <div className="flex items-center justify-between mt-3 text-xs" style={{ color: "var(--color-muted)" }}>
          <span>
            <span className="num font-medium" style={{ color: "var(--color-text)" }}>
              {pct(h.completionRate)}
            </span>{" "}
            last 30 days
          </span>
          {h.missTwice && (
            <span className="flex items-center gap-1" style={{ color: "var(--color-warn)" }}>
              <AlertTriangle size={13} /> never miss twice
            </span>
          )}
        </div>
      </Card>
    </button>
  );
}

// GitHub-style heatmap: columns = weeks (Monday-anchored), rows = Mon..Sun.
// Pure CSS grid coloured by completion status — recharts has no equivalent.
function Heatmap({ logs, today, historyDays }: { logs: HabitLogDTO[]; today: string; historyDays: number }) {
  const cells = useMemo(() => {
    const status = new Map(logs.map((l) => [l.date, l.status]));
    // Walk back to a Monday at/before the window start, so columns align.
    let start = addDaysKey(today, -(historyDays - 1));
    const startDow = new Date(start + "T00:00:00.000Z").getUTCDay(); // 0=Sun
    start = addDaysKey(start, -((startDow + 6) % 7));

    const weeks: { key: string; status: string | null; future: boolean }[][] = [];
    let cursor = start;
    while (cursor <= today || new Date(cursor + "T00:00:00.000Z").getUTCDay() !== 1) {
      const col: { key: string; status: string | null; future: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        col.push({ key: cursor, status: status.get(cursor) ?? null, future: cursor > today });
        cursor = addDaysKey(cursor, 1);
      }
      weeks.push(col);
      if (cursor > addDaysKey(today, 7)) break; // safety
    }
    return weeks;
  }, [logs, today, historyDays]);

  function color(status: string | null, future: boolean): string {
    if (future) return "transparent";
    if (status === "done") return "var(--color-accent)";
    if (status === "partial") return "var(--color-accent-dim)";
    if (status === "skipped") return "var(--color-surface-2)";
    return "var(--color-surface-2)";
  }

  return (
    <div className="flex gap-[3px] overflow-hidden">
      {cells.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-[3px]">
          {week.map((cell) => (
            <div
              key={cell.key}
              title={cell.future ? "" : `${cell.key}${cell.status ? ` · ${cell.status}` : ""}`}
              className="h-[10px] w-[10px] rounded-[2px]"
              style={{ background: color(cell.status, cell.future) }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

const inputStyle = { background: "var(--color-surface-2)", border: "1px solid var(--color-border)" } as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function HabitModal({ habit, values, goals, onClose }: { habit: HabitDTO | null; values: Ref[]; goals: Ref[]; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: habit?.name ?? "",
    identityStatement: habit?.identityStatement ?? "",
    type: habit?.type ?? "build",
    cadence: habit?.cadence ?? "daily",
    targetCount: habit?.targetCount != null ? String(habit.targetCount) : "3",
    valueId: habit?.valueId ?? "",
    goalId: habit?.goalId ?? "",
    cue: habit?.cue ?? "",
    craving: habit?.craving ?? "",
    response: habit?.response ?? "",
    reward: habit?.reward ?? "",
    twoMinVersion: habit?.twoMinVersion ?? "",
    rewardBundle: habit?.rewardBundle ?? "",
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const [weekdays, setWeekdays] = useState<number[]>(
    (habit?.weekdays ?? "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n)),
  );
  const toggleDay = (d: number) =>
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  async function save() {
    setBusy(true);
    const payload = {
      ...(habit ? { id: habit.id } : {}),
      name: f.name,
      identityStatement: f.identityStatement,
      type: f.type,
      cadence: f.cadence,
      targetCount: f.cadence === "weekly_count" ? Number(f.targetCount) || 1 : null,
      weekdays: f.cadence === "weekdays" ? weekdays : null,
      valueId: f.valueId || null,
      goalId: f.goalId || null,
      cue: f.cue,
      craving: f.craving,
      response: f.response,
      reward: f.reward,
      twoMinVersion: f.twoMinVersion,
      rewardBundle: f.rewardBundle,
    };
    const res = await fetch("/api/habits", {
      method: habit ? "PUT" : "POST",
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
    if (!habit) return;
    setBusy(true);
    await fetch("/api/habits", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: habit.id }),
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
            <div className="font-semibold">{habit ? "Edit habit" : "New habit"}</div>
            <button onClick={onClose} style={{ color: "var(--color-muted)" }}>
              <X size={18} />
            </button>
          </div>

          <div className="space-y-3">
            <Field label="Habit">
              <input
                autoFocus
                value={f.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Read 10 pages"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              />
            </Field>
            <Field label="Identity it votes for">
              <input
                value={f.identityStatement}
                onChange={(e) => set("identityStatement", e.target.value)}
                placeholder="e.g. I am a reader"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <select value={f.type} onChange={(e) => set("type", e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                  <option value="build">Build</option>
                  <option value="break">Break</option>
                </select>
              </Field>
              <Field label="Cadence">
                <select value={f.cadence} onChange={(e) => set("cadence", e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                  <option value="daily">Daily</option>
                  <option value="weekly_count">Times per week</option>
                  <option value="weekdays">Specific weekdays</option>
                </select>
              </Field>
            </div>

            {f.cadence === "weekly_count" && (
              <Field label="Times per week">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={7}
                  value={f.targetCount}
                  onChange={(e) => set("targetCount", e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm num"
                  style={inputStyle}
                />
              </Field>
            )}

            {f.cadence === "weekdays" && (
              <Field label="On these days">
                <div className="flex gap-1.5">
                  {WEEKDAY_ORDER.map((d) => {
                    const on = weekdays.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(d)}
                        className="flex-1 rounded-lg py-1.5 text-xs transition-colors"
                        style={{
                          background: on ? "var(--color-accent-dim)" : "var(--color-surface-2)",
                          border: `1px solid ${on ? "var(--color-accent)" : "var(--color-border)"}`,
                          color: on ? "var(--color-accent)" : "var(--color-muted)",
                        }}
                      >
                        {DAY_LABELS[d][0]}
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}

            {(values.length > 0 || goals.length > 0) && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Value it serves">
                  <select value={f.valueId} onChange={(e) => set("valueId", e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                    <option value="">— none —</option>
                    {values.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Leading indicator for">
                  <select value={f.goalId} onChange={(e) => set("goalId", e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                    <option value="">— no goal —</option>
                    {goals.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            <Field label="Reward bundle (temptation bundling)">
              <input
                value={f.rewardBundle}
                onChange={(e) => set("rewardBundle", e.target.value)}
                placeholder="Pair it with a treat — e.g. a Spotify playlist link"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              />
            </Field>

            <details className="rounded-lg px-3 py-2" style={{ background: "var(--color-surface-2)" }}>
              <summary className="text-xs cursor-pointer select-none" style={{ color: "var(--color-muted)" }}>
                The 4 laws (optional)
              </summary>
              <div className="space-y-3 mt-3">
                <Field label="Two-minute version">
                  <input value={f.twoMinVersion} onChange={(e) => set("twoMinVersion", e.target.value)} placeholder="Make it so easy you can't say no" className="w-full rounded-lg px-3 py-2 text-sm" style={{ ...inputStyle, background: "var(--color-bg)" }} />
                </Field>
                <Field label="Cue (make it obvious)">
                  <input value={f.cue} onChange={(e) => set("cue", e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ ...inputStyle, background: "var(--color-bg)" }} />
                </Field>
                <Field label="Craving (make it attractive)">
                  <input value={f.craving} onChange={(e) => set("craving", e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ ...inputStyle, background: "var(--color-bg)" }} />
                </Field>
                <Field label="Response (make it easy)">
                  <input value={f.response} onChange={(e) => set("response", e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ ...inputStyle, background: "var(--color-bg)" }} />
                </Field>
                <Field label="Reward (make it satisfying)">
                  <input value={f.reward} onChange={(e) => set("reward", e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ ...inputStyle, background: "var(--color-bg)" }} />
                </Field>
              </div>
            </details>
          </div>

          <div className="flex items-center gap-2 mt-5">
            <button
              onClick={save}
              disabled={busy || f.name.trim() === ""}
              className="flex-1 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
            >
              {busy ? "Saving…" : habit ? "Save changes" : "Create habit"}
            </button>
            {habit && (
              <button
                onClick={remove}
                disabled={busy}
                title="Delete habit"
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
