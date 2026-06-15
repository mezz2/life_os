"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X, Clock } from "lucide-react";
import { Card, Badge, EmptyState } from "@/components/ui";
import { Portal } from "@/components/Portal";
import { formatMinutes, durationMin, weekDayKeys, RIGIDITIES, type ValueTime } from "@/lib/calendar";

export type CalEventDTO = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  rigidity: string;
  valueId: string | null;
  goalId: string | null;
  dayKey: string;
};

type Ref = { id: string; name: string };

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// Stable palette for value bars/dots.
const PALETTE = ["#34d399", "#60a5fa", "#f472b6", "#fbbf24", "#a78bfa", "#fb7185", "#22d3ee"];

function valueColor(valueId: string | null, values: Ref[]): string {
  if (!valueId) return "var(--color-surface-2)";
  const idx = values.findIndex((v) => v.id === valueId);
  return idx >= 0 ? PALETTE[idx % PALETTE.length] : "var(--color-accent)";
}

function fmtRange(weekStart: string): string {
  const s = new Date(weekStart + "T00:00:00Z");
  const e = new Date(weekStart + "T00:00:00Z");
  e.setUTCDate(e.getUTCDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "UTC" };
  return `${s.toLocaleDateString("en-AU", opts)} – ${e.toLocaleDateString("en-AU", opts)}`;
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
}

export function CalendarClient({
  weekStart,
  prevWeek,
  nextWeek,
  today,
  events,
  byValue,
  values,
}: {
  weekStart: string;
  prevWeek: string;
  nextWeek: string;
  today: string;
  events: CalEventDTO[];
  byValue: ValueTime[];
  values: Ref[];
}) {
  const [editing, setEditing] = useState<CalEventDTO | null>(null);
  const days = weekDayKeys(weekStart);
  const totalMins = byValue.reduce((t, v) => t + v.minutes, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-medium">{fmtRange(weekStart)}</div>
        <div className="flex items-center gap-1">
          <Link href={`/calendar?week=${prevWeek}`} className="rounded-lg p-2" style={{ background: "var(--color-surface-2)" }} aria-label="Previous week">
            <ChevronLeft size={16} />
          </Link>
          <Link href="/calendar" className="rounded-lg px-3 py-2 text-xs" style={{ background: "var(--color-surface-2)" }}>
            This week
          </Link>
          <Link href={`/calendar?week=${nextWeek}`} className="rounded-lg p-2" style={{ background: "var(--color-surface-2)" }} aria-label="Next week">
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="No events cached for this week"
          hint="Sync from Google Calendar (POST events to /api/calendar/sync) or add an event, then tag each to a value."
        />
      ) : (
        <>
          <Card className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={16} style={{ color: "var(--color-muted)" }} />
              <span className="text-sm font-medium">Time by value</span>
              <span className="text-xs num ml-auto" style={{ color: "var(--color-muted)" }}>{formatMinutes(totalMins)} tracked</span>
            </div>
            <div className="space-y-2">
              {byValue.map((v) => (
                <div key={v.valueId ?? "untagged"} className="flex items-center gap-3">
                  <span className="text-xs w-24 shrink-0 truncate" style={{ color: "var(--color-muted)" }}>{v.name}</span>
                  <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${totalMins ? (v.minutes / totalMins) * 100 : 0}%`, background: valueColor(v.valueId, values) }}
                    />
                  </div>
                  <span className="text-xs num w-16 text-right shrink-0">{formatMinutes(v.minutes)}</span>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
            {days.map((dk, i) => {
              const dayEvents = events.filter((e) => e.dayKey === dk);
              const isToday = dk === today;
              return (
                <div key={dk} className="min-w-0">
                  <div className="text-xs mb-2 flex items-center gap-1.5" style={{ color: isToday ? "var(--color-accent)" : "var(--color-muted)" }}>
                    <span className="font-medium">{DAY_LABELS[i]}</span>
                    <span className="num">{dk.slice(8)}</span>
                  </div>
                  <div className="space-y-1.5">
                    {dayEvents.length === 0 && <div className="text-[11px]" style={{ color: "var(--color-border)" }}>—</div>}
                    {dayEvents.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => setEditing(e)}
                        className="w-full text-left rounded-lg p-2 text-xs transition-colors hover:opacity-90"
                        style={{ background: "var(--color-surface-2)", borderLeft: `3px solid ${valueColor(e.valueId, values)}` }}
                      >
                        <div className="font-medium truncate">{e.title}</div>
                        <div className="num mt-0.5" style={{ color: "var(--color-muted)" }}>
                          {e.allDay ? "all day" : `${timeLabel(e.start)} · ${formatMinutes(durationMin(e.start, e.end))}`}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {editing && <TagModal event={editing} values={values} onClose={() => setEditing(null)} />}
    </div>
  );
}

const inputStyle = { background: "var(--color-surface-2)", border: "1px solid var(--color-border)" } as const;

function TagModal({ event, values, onClose }: { event: CalEventDTO; values: Ref[]; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rigidity, setRigidity] = useState(event.rigidity);
  const [valueId, setValueId] = useState(event.valueId ?? "");

  async function save() {
    setBusy(true);
    const res = await fetch("/api/calendar/event", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: event.id, rigidity, valueId: valueId || null }),
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
          <div className="flex items-center justify-between mb-1">
            <div className="font-semibold truncate">{event.title}</div>
            <button onClick={onClose} style={{ color: "var(--color-muted)" }}>
              <X size={18} />
            </button>
          </div>
          <div className="text-xs mb-4" style={{ color: "var(--color-muted)" }}>
            {event.allDay ? "All day" : `${timeLabel(event.start)} – ${timeLabel(event.end)}`}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--color-muted)" }}>Flexibility (used by the shuffle engine)</label>
              <div className="grid grid-cols-4 gap-1.5">
                {RIGIDITIES.map((r) => {
                  const on = r === rigidity;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRigidity(r)}
                      className="rounded-lg py-1.5 text-[11px] capitalize transition-colors"
                      style={{
                        background: on ? "var(--color-accent-dim)" : "var(--color-surface-2)",
                        border: `1px solid ${on ? "var(--color-accent)" : "var(--color-border)"}`,
                        color: on ? "var(--color-accent)" : "var(--color-muted)",
                      }}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>Value it serves</label>
              <select value={valueId} onChange={(e) => setValueId(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                <option value="">— untagged —</option>
                {values.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            {values.length === 0 && (
              <p className="text-[11px]" style={{ color: "var(--color-muted)" }}>
                Create values on the Values tab to tag your time against them.
              </p>
            )}
          </div>

          <button
            onClick={save}
            disabled={busy}
            className="mt-5 w-full rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
          >
            {busy ? "Saving…" : "Save tags"}
          </button>
          {event.rigidity && (
            <div className="flex justify-center mt-3">
              <Badge>{event.rigidity}</Badge>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
