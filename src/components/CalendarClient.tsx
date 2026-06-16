"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X, Clock, RefreshCw, Link2, Unlink, AlertCircle, CheckCircle2 } from "lucide-react";
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

export type GoogleState = {
  configured: boolean;
  connected: boolean;
  calendarId: string | null;
  syncedAt: string | null;
};

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
  google,
  notice,
}: {
  weekStart: string;
  prevWeek: string;
  nextWeek: string;
  today: string;
  events: CalEventDTO[];
  byValue: ValueTime[];
  values: Ref[];
  google: GoogleState;
  notice: string | null;
}) {
  const [editing, setEditing] = useState<CalEventDTO | null>(null);
  const days = weekDayKeys(weekStart);
  const totalMins = byValue.reduce((t, v) => t + v.minutes, 0);

  return (
    <div>
      <SyncBar google={google} notice={notice} />
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
          hint={google.connected
            ? "Hit Refresh sync to pull this week from Google, then tag each event to a value."
            : "Connect Google Calendar above to sync your events, then tag each to a value."}
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

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function SyncBar({ google, notice }: { google: GoogleState; notice: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/calendar/refresh", { method: "POST" });
      const data = (await res.json()) as { added?: number; updated?: number; error?: string };
      if (!res.ok) {
        setMsg(data.error ?? "Sync failed");
      } else {
        setMsg(`Synced — ${data.added ?? 0} new, ${data.updated ?? 0} updated`);
        router.refresh();
      }
    } catch {
      setMsg("Sync failed — is the app online?");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm("Forget the Google Calendar connection on this device? Your events stay cached. Revoke fully at myaccount.google.com.")) return;
    await fetch("/api/calendar/auth", { method: "DELETE" });
    router.refresh();
  }

  // One-time banner from the OAuth redirect.
  const banner =
    notice === "connected"
      ? { ok: true, text: "Google Calendar connected. Hit Refresh sync to pull your events." }
      : notice === "not-configured"
        ? { ok: false, text: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local, then restart the app." }
        : notice
          ? { ok: false, text: `Connection error: ${notice}` }
          : null;

  return (
    <div className="mb-4">
      {banner && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 mb-3 text-xs"
          style={{
            background: "var(--color-surface-2)",
            border: `1px solid ${banner.ok ? "var(--color-accent)" : "#f87171"}`,
            color: banner.ok ? "var(--color-accent)" : "#f87171",
          }}
        >
          {banner.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          <span>{banner.text}</span>
        </div>
      )}
      <Card>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ background: google.connected ? "var(--color-accent)" : "var(--color-border)" }}
            />
            <div className="min-w-0">
              <div className="text-sm font-medium">
                {google.connected ? "Google Calendar connected" : "Google Calendar not connected"}
              </div>
              <div className="text-[11px]" style={{ color: "var(--color-muted)" }}>
                {google.connected
                  ? `${google.calendarId ?? "primary"} · last sync ${relativeTime(google.syncedAt)}`
                  : google.configured
                    ? "Connect to sync events and edit your schedule from here."
                    : "Add Google credentials to .env.local to enable syncing."}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            {google.connected ? (
              <>
                <button
                  onClick={refresh}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50"
                  style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
                >
                  <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
                  {busy ? "Syncing…" : "Refresh sync"}
                </button>
                <button
                  onClick={disconnect}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs"
                  style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}
                  aria-label="Disconnect"
                >
                  <Unlink size={14} />
                </button>
              </>
            ) : (
              <a
                href="/api/calendar/auth"
                aria-disabled={!google.configured}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium"
                style={{
                  background: google.configured ? "var(--color-accent)" : "var(--color-surface-2)",
                  color: google.configured ? "var(--color-bg)" : "var(--color-muted)",
                  pointerEvents: google.configured ? "auto" : "none",
                }}
              >
                <Link2 size={14} />
                Connect Google Calendar
              </a>
            )}
          </div>
        </div>
        {msg && (
          <div className="text-[11px] mt-2" style={{ color: "var(--color-muted)" }}>{msg}</div>
        )}
      </Card>
    </div>
  );
}

// ISO ⇄ <input type="datetime-local"> value (local wall-clock).
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function TagModal({ event, values, onClose }: { event: CalEventDTO; values: Ref[]; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rigidity, setRigidity] = useState(event.rigidity);
  const [valueId, setValueId] = useState(event.valueId ?? "");
  const [title, setTitle] = useState(event.title);
  const [start, setStart] = useState(event.allDay ? event.start : toLocalInput(event.start));
  const [end, setEnd] = useState(event.allDay ? event.end : toLocalInput(event.end));

  async function save() {
    setBusy(true);
    setErr(null);
    // Only send schedule fields when they actually changed, so tagging-only
    // saves don't trigger a Google write.
    const body: Record<string, unknown> = { id: event.id, rigidity, valueId: valueId || null };
    if (title.trim() !== event.title) body.title = title.trim();
    if (!event.allDay) {
      const startIso = new Date(start).toISOString();
      const endIso = new Date(end).toISOString();
      if (startIso !== event.start) body.start = startIso;
      if (endIso !== event.end) body.end = endIso;
    }
    const res = await fetch("/api/calendar/event", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) {
      onClose();
      router.refresh();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(data.error ?? "Couldn't save");
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
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>Edit event</div>
            <button onClick={onClose} style={{ color: "var(--color-muted)" }}>
              <X size={18} />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              />
            </div>
            {event.allDay ? (
              <div className="text-[11px]" style={{ color: "var(--color-muted)" }}>
                All-day event — edit the date in Google Calendar.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>Start</label>
                  <input
                    type="datetime-local"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="w-full rounded-lg px-2 py-2 text-sm"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>End</label>
                  <input
                    type="datetime-local"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="w-full rounded-lg px-2 py-2 text-sm"
                    style={inputStyle}
                  />
                </div>
              </div>
            )}
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

          {err && (
            <div className="text-[11px] mt-3" style={{ color: "#f87171" }}>{err}</div>
          )}
          <button
            onClick={save}
            disabled={busy}
            className="mt-3 w-full rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
          >
            {busy ? "Saving…" : "Save"}
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
