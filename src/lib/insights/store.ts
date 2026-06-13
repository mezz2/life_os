import { db } from "@/lib/db";
import type { InsightDTO } from "@/components/InsightCard";
import { placement, isWorthwhile, type InsightPage } from "./placement";

const SEVERITY_RANK = { alert: 0, warn: 1, info: 2 } as Record<string, number>;

function toDTO(r: {
  id: string;
  type: string;
  severity: string;
  title: string;
  body: string;
  generatedAt: Date;
}): InsightDTO {
  return {
    id: r.id,
    type: r.type,
    severity: r.severity,
    title: r.title,
    body: r.body,
    generatedAt: r.generatedAt.toISOString(),
  };
}

// Bucket a pre-fetched list of insights into their slots for a given page.
// Pure (no DB) so callers that already loaded the rows (e.g. the Budget page)
// can reuse them. Each slot is severity-sorted (alerts first).
export function groupBySlot(
  insights: InsightDTO[],
  page: InsightPage,
): Record<string, InsightDTO[]> {
  const bySlot: Record<string, InsightDTO[]> = {};
  for (const i of insights) {
    const p = placement(i);
    if (p.page !== page) continue;
    (bySlot[p.slot] ??= []).push(i);
  }
  for (const slot of Object.keys(bySlot)) {
    bySlot[slot].sort(
      (a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3),
    );
  }
  return bySlot;
}

// Fetch non-dismissed insights for a page, grouped by slot. One small query —
// the Insight table is tiny — so per-page calls are cheap.
export async function getPageInsights(
  page: InsightPage,
): Promise<Record<string, InsightDTO[]>> {
  const rows = await db.insight.findMany({
    where: { dismissed: false },
    orderBy: [{ generatedAt: "desc" }],
  });
  return groupBySlot(rows.map(toDTO), page);
}

// Top strategic items across the whole app, for the dashboard roll-up. Alerts
// and warnings only (plus narrative), severity-sorted, capped.
export async function getNeedsAttention(limit = 4): Promise<InsightDTO[]> {
  const rows = await db.insight.findMany({
    where: { dismissed: false },
    orderBy: [{ generatedAt: "desc" }],
  });
  return rows
    .filter((r) => isWorthwhile(r) && r.type !== "narrative")
    .map(toDTO)
    .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3))
    .slice(0, limit);
}
