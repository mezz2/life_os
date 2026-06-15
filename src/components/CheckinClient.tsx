"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Battery, Smile, Moon, TrendingUp, Sparkles } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import { Sparkline } from "@/components/Sparkline";
import { pct } from "@/lib/format";

export type CheckinDTO = {
  date: string;
  energy: number;
  mood: number;
  sleepHours: number | null;
  note: string | null;
};

export type Correlation = { r: number; n: number; label: string };

const SCALE = [1, 2, 3, 4, 5];

export function CheckinClient({
  today,
  todayCheckin,
  history,
  correlation,
}: {
  today: string;
  todayCheckin: CheckinDTO | null;
  history: CheckinDTO[];
  correlation: Correlation | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [energy, setEnergy] = useState(todayCheckin?.energy ?? 3);
  const [mood, setMood] = useState(todayCheckin?.mood ?? 3);
  const [sleep, setSleep] = useState(todayCheckin?.sleepHours != null ? String(todayCheckin.sleepHours) : "");
  const [note, setNote] = useState(todayCheckin?.note ?? "");
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: today, energy, mood, sleepHours: sleep === "" ? null : Number(sleep), note }),
    });
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 1500);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Card>
        <div className="text-sm font-medium mb-4">{todayCheckin ? "Today’s check-in" : "How are you today?"}</div>

        <Scale label="Energy" icon={<Battery size={15} />} value={energy} onChange={setEnergy} />
        <Scale label="Mood" icon={<Smile size={15} />} value={mood} onChange={setMood} />

        <div className="mt-4">
          <label className="flex items-center gap-2 text-xs mb-1" style={{ color: "var(--color-muted)" }}>
            <Moon size={15} /> Sleep (hours)
          </label>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            min={0}
            max={24}
            value={sleep}
            onChange={(e) => setSleep(e.target.value)}
            placeholder="e.g. 7.5"
            className="w-full rounded-lg px-3 py-2 text-sm num"
            style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
          />
        </div>

        <div className="mt-4">
          <label className="block text-xs mb-1" style={{ color: "var(--color-muted)" }}>Note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="One line on the day…"
            className="w-full rounded-lg px-3 py-2 text-sm resize-none"
            style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
          />
        </div>

        <button
          onClick={save}
          disabled={busy}
          className="mt-4 w-full rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        >
          {busy ? "Saving…" : saved ? "Saved ✓" : todayCheckin ? "Update check-in" : "Save check-in"}
        </button>
      </Card>

      <div className="space-y-5">
        {correlation && (
          <Card>
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles size={16} style={{ color: "var(--color-accent)" }} />
              <span className="text-sm font-medium">Energy ↔ habits</span>
            </div>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              A <strong style={{ color: "var(--color-text)" }}>{correlation.label}</strong> correlation
              (r={correlation.r.toFixed(2)}) between your energy and habits completed, over{" "}
              <span className="num">{correlation.n}</span> days.{" "}
              {correlation.r >= 0.3
                ? "Higher-energy days are also more productive days."
                : correlation.r <= -0.3
                  ? "Interestingly, you complete more on lower-energy days."
                  : "No strong link yet — keep checking in."}
            </p>
          </Card>
        )}

        <Card>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} style={{ color: "var(--color-muted)" }} />
            <span className="text-sm font-medium">Last {history.length} day{history.length === 1 ? "" : "s"}</span>
          </div>
          {history.length < 2 ? (
            <EmptyState title="Not enough history yet" hint="Check in a few days to see your trends." />
          ) : (
            <div className="space-y-4">
              <Trend label="Energy" data={history.map((h) => h.energy)} color="#34d399" />
              <Trend label="Mood" data={history.map((h) => h.mood)} color="#60a5fa" />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Scale({
  label,
  icon,
  value,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 text-xs mb-1.5" style={{ color: "var(--color-muted)" }}>
        {icon} {label}
      </div>
      <div className="flex gap-1.5">
        {SCALE.map((n) => {
          const on = n <= value;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-label={`${label} ${n}`}
              className="flex-1 rounded-lg py-2 text-sm num transition-colors"
              style={{
                background: on ? "var(--color-accent-dim)" : "var(--color-surface-2)",
                border: `1px solid ${n === value ? "var(--color-accent)" : on ? "var(--color-accent-dim)" : "var(--color-border)"}`,
                color: on ? "var(--color-accent)" : "var(--color-muted)",
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Trend({ label, data, color }: { label: string; data: number[]; color: string }) {
  const avg = data.reduce((t, v) => t + v, 0) / data.length;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span style={{ color: "var(--color-muted)" }}>{label}</span>
        <span className="num" style={{ color: "var(--color-muted)" }}>avg {avg.toFixed(1)} · {pct(avg / 5)}</span>
      </div>
      <Sparkline data={data} color={color} height={48} />
    </div>
  );
}
