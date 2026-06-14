// Where each insight surfaces. Derived purely from the insight's `type` (and
// severity), so the routing can evolve without a DB migration. One home per
// insight — an insight shows on exactly one page/slot, never duplicated.

export type InsightPage = "budget" | "goals" | "net-worth" | "habits";
export type Placement = { page: InsightPage; slot: string };

// A minimal shape — works for both Prisma rows and InsightDTOs.
type Routable = { type: string; severity: string };

// type -> { page, slot }. Slots map to the InsightSlot anchors dropped into
// each page. Unknown types fall back to the Flows slot so nothing is lost.
export function placement(i: Routable): Placement {
  switch (i.type) {
    case "overspend":
      return { page: "budget", slot: "plan" };
    case "spike":
    case "subscription":
    case "large_txn":
      return { page: "budget", slot: "flows" };
    case "savings_rate":
    case "yoy":
      return { page: "budget", slot: "trends" };
    case "narrative":
      return { page: "budget", slot: "overview" };
    case "goal_pace":
      return { page: "goals", slot: "goals" };
    case "net_worth":
      return { page: "net-worth", slot: "net-worth" };
    default:
      return { page: "budget", slot: "flows" };
  }
}

// The dashboard "Needs attention" roll-up and cross-page strips only surface
// genuinely strategic items: warnings, alerts, and the narrative. Routine
// info-level items still appear on their home tab, just not in the roll-up.
export function isWorthwhile(i: Routable): boolean {
  return i.type === "narrative" || i.severity === "warn" || i.severity === "alert";
}

// Deep-link target for an insight: the page plus, for the tabbed Budget hub,
// the tab it lives on (so a dashboard alert lands on the right tab).
export function insightHref(i: Routable): string {
  const p = placement(i);
  if (p.page === "budget") {
    return p.slot === "overview" ? "/budget" : `/budget?tab=${p.slot}`;
  }
  return `/${p.page}`;
}
