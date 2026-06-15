"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Wallet, Vote, Battery, Compass, Tag } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import { aud, pct } from "@/lib/format";
import type { AlignmentReport, ValueAlignment } from "@/lib/alignment";

export type SubcatRow = { id: string; name: string; category: string; valueId: string | null };
type Ref = { id: string; name: string };

const inputStyle = { background: "var(--color-surface-2)", border: "1px solid var(--color-border)" } as const;

function hm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function AlignClient({
  report,
  values,
  subcats,
  windowDays,
}: {
  report: AlignmentReport;
  values: Ref[];
  subcats: SubcatRow[];
  windowDays: number;
}) {
  const engaged = report.values.filter((v) => v.minutes > 0 || v.money > 0 || v.votes > 0);

  return (
    <div className="space-y-6">
      {values.length === 0 ? (
        <EmptyState title="No values yet" hint="Define a few values first — everything rolls up to them." />
      ) : engaged.length === 0 ? (
        <EmptyState
          title="Nothing to align yet"
          hint="Tag calendar events and habits to values, and map spending categories below, then this fills in."
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {report.values.map((v) => (
            <ValueCard key={v.id} v={v} />
          ))}
        </div>
      )}

      {(report.unattributed.minutes > 0 || report.unattributed.money > 0 || report.unattributed.votes > 0) && (
        <div className="text-xs" style={{ color: "var(--color-muted)" }}>
          Unattributed (no value tagged): {hm(report.unattributed.minutes)} of time · {aud(report.unattributed.money)} spent · {report.unattributed.votes} vote{report.unattributed.votes === 1 ? "" : "s"}.
        </div>
      )}

      <MoneyMapping values={values} subcats={subcats} windowDays={windowDays} />
    </div>
  );
}

function ValueCard({ v }: { v: ValueAlignment }) {
  return (
    <Card className="h-full">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Compass size={16} style={{ color: "var(--color-accent)" }} />
          <span className="font-medium truncate">{v.name}</span>
        </div>
        <span className="num text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }} title="Balanced engagement score">
          {pct(v.score)}
        </span>
      </div>

      <div className="space-y-2.5">
        <Dim icon={<Clock size={14} />} label="Time" value={hm(v.minutes)} share={v.timeShare} />
        <Dim icon={<Wallet size={14} />} label="Money" value={aud(v.money)} share={v.moneyShare} />
        <Dim icon={<Vote size={14} />} label="Votes" value={`${v.votes}`} share={v.voteShare} />
        <div className="flex items-center gap-2 text-sm">
          <span style={{ color: "var(--color-muted)" }}><Battery size={14} /></span>
          <span className="w-12 text-xs" style={{ color: "var(--color-muted)" }}>Energy</span>
          <span className="num">{v.energy != null ? `${v.energy.toFixed(1)}/5` : "—"}</span>
          {v.activeDays > 0 && <span className="text-xs" style={{ color: "var(--color-muted)" }}>· {v.activeDays} active day{v.activeDays === 1 ? "" : "s"}</span>}
        </div>
      </div>
    </Card>
  );
}

function Dim({ icon, label, value, share }: { icon: React.ReactNode; label: string; value: string; share: number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span style={{ color: "var(--color-muted)" }}>{icon}</span>
      <span className="w-12 text-xs" style={{ color: "var(--color-muted)" }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.round(share * 100)}%`, background: "var(--color-accent)" }} />
      </div>
      <span className="num text-xs w-16 text-right">{value}</span>
    </div>
  );
}

// Tag expense subcategories to a value so "money per value" becomes real.
function MoneyMapping({ values, subcats, windowDays }: { values: Ref[]; subcats: SubcatRow[]; windowDays: number }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function assign(id: string, valueId: string) {
    setPending(id);
    await fetch("/api/subcategories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, valueId: valueId || null }),
    });
    setPending(null);
    router.refresh();
  }

  // Group by category for readability.
  const byCat = new Map<string, SubcatRow[]>();
  for (const s of subcats) {
    if (!byCat.has(s.category)) byCat.set(s.category, []);
    byCat.get(s.category)!.push(s);
  }

  if (values.length === 0) return null;

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <Tag size={15} style={{ color: "var(--color-accent)" }} />
        <span className="text-sm font-medium">Map spending to values</span>
      </div>
      <p className="text-xs mb-4" style={{ color: "var(--color-muted)" }}>
        Tag each expense category to the value it serves — that&apos;s how money joins time and energy above (applies to all of the last {windowDays} days&apos; transactions).
      </p>
      {subcats.length === 0 ? (
        <div className="text-sm" style={{ color: "var(--color-muted)" }}>No expense categories yet.</div>
      ) : (
        <div className="space-y-4">
          {[...byCat.entries()].map(([cat, rows]) => (
            <div key={cat}>
              <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--color-muted)" }}>{cat}</div>
              <div className="grid sm:grid-cols-2 gap-2">
                {rows.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="text-sm flex-1 truncate">{s.name}</span>
                    <select
                      value={s.valueId ?? ""}
                      disabled={pending === s.id}
                      onChange={(e) => assign(s.id, e.target.value)}
                      className="rounded-lg px-2 py-1.5 text-xs disabled:opacity-50"
                      style={inputStyle}
                    >
                      <option value="">— none —</option>
                      {values.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
