import { PageHeader, Stat, Badge } from "@/components/ui";
import { NetWorthBoard } from "@/components/NetWorthBoard";
import { AddSnapshot } from "@/components/AddSnapshot";
import { InsightSlot } from "@/components/budget/InsightSlot";
import { getNetWorthSeries, getLatestNetWorth, getNetWorthBuckets } from "@/lib/queries";
import { getPageInsights } from "@/lib/insights/store";
import { aud, fmtDate, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function NetWorthPage() {
  const [series, latest, buckets, slots] = await Promise.all([
    getNetWorthSeries(),
    getLatestNetWorth(),
    getNetWorthBuckets(),
    getPageInsights("net-worth"),
  ]);

  const bucketNames = buckets.map((b) => b.name);
  const first = series[0];
  const lifetimeChange = latest && first ? latest.latest.total - first.total : 0;

  // Assets vs liabilities split from the latest snapshot.
  let assets = 0;
  let liabilities = 0;
  if (latest) {
    for (const b of buckets) {
      const v = Number(latest.latest[b.name] ?? 0);
      if (v < 0) liabilities += v;
      else assets += v;
    }
  }
  const hasLiabilities = liabilities < 0;

  return (
    <div>
      <PageHeader
        title="Net Worth"
        subtitle={`Tracked across ${buckets.length} buckets`}
        action={<AddSnapshot buckets={buckets} latest={latest?.latest ?? null} />}
      />

      <InsightSlot insights={slots["net-worth"]} className="mb-6" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat
          label="Total net worth"
          value={latest ? aud(latest.latest.total) : "—"}
          sub={latest ? `as at ${fmtDate(latest.latest.date)}` : undefined}
        />
        <Stat
          label="Since last snapshot"
          value={latest ? aud(latest.change, { sign: true }) : "—"}
          tone={latest && latest.change >= 0 ? "positive" : "negative"}
          sub={latest ? pct(latest.changePct, 1) : undefined}
        />
        {hasLiabilities ? (
          <Stat label="Assets" value={aud(assets)} sub={`liabilities ${aud(liabilities)}`} tone="positive" />
        ) : (
          <Stat
            label="Since first record"
            value={aud(lifetimeChange, { sign: true })}
            tone={lifetimeChange >= 0 ? "positive" : "negative"}
            sub={first ? `from ${fmtDate(first.date)}` : undefined}
          />
        )}
        <Stat label="Snapshots" value={series.length} sub="data points" />
      </div>

      <NetWorthBoard series={series} buckets={bucketNames} />

      <p className="text-xs mt-4" style={{ color: "var(--color-muted)" }}>
        <Badge tone="accent">tip</Badge> Add a snapshot whenever you check your balances, or click any
        row to view and delete a date’s entry. Use “Add asset” / “Add liability” to track new
        accounts or debts — the chart, totals and linked goals update automatically.
      </p>
    </div>
  );
}
