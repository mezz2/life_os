import { db } from "@/lib/db";
import { dateKey } from "@/lib/habits";
import { proposeSchedule, applyDemand, type Block, type Busy, type Demand, type Proposal } from "@/lib/shuffle";

// NOTE: minutes-from-midnight are computed in UTC, consistent with the rest of
// LifeOS's UTC day-keying. A timezone-aware pass is a tracked follow-up.
function utcMinutes(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

type TimeBlockRow = {
  id: string; title: string; rigidity: string; durationMin: number; minChunkMin: number;
  energy: string; days: string | null; startMin: number; endMin: number; habitId: string | null; priority: number;
};

export function toBlock(tb: TimeBlockRow): Block {
  return {
    id: tb.id,
    title: tb.title,
    rigidity: (tb.rigidity as Block["rigidity"]) ?? "flexible",
    durationMin: tb.durationMin,
    minChunkMin: tb.minChunkMin,
    energy: (tb.energy as Block["energy"]) ?? "any",
    days: tb.days ? tb.days.split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n)) : [],
    startMin: tb.startMin,
    endMin: tb.endMin,
    habitId: tb.habitId,
    priority: tb.priority,
  };
}

// Fixed commitments = real (non-shuffle) calendar events in the week, excluding
// all-day events (no meaningful time slot).
export function busyFromEvents(
  events: { start: Date; end: Date; allDay: boolean; shuffleBatch: string | null }[],
): Busy[] {
  const out: Busy[] = [];
  for (const e of events) {
    if (e.allDay || e.shuffleBatch) continue;
    const startMin = utcMinutes(e.start);
    let endMin = utcMinutes(e.end);
    if (endMin <= startMin) endMin = 1440; // crosses midnight -> clamp to day end
    out.push({ dayKey: dateKey(e.start), startMin, endMin });
  }
  return out;
}

export async function buildProposal(
  weekStartKey: string,
  demand: Demand,
): Promise<{ proposal: Proposal; busyCount: number; blockCount: number }> {
  const weekEndKey = dateKey(new Date(new Date(weekStartKey + "T00:00:00.000Z").getTime() + 7 * 86400000));
  const [tbs, events] = await Promise.all([
    db.timeBlock.findMany(),
    db.calendarEvent.findMany({
      where: {
        start: { gte: new Date(weekStartKey + "T00:00:00.000Z"), lt: new Date(weekEndKey + "T00:00:00.000Z") },
      },
      select: { start: true, end: true, allDay: true, shuffleBatch: true },
    }),
  ]);
  const baseBlocks = tbs.map(toBlock);
  const baseBusy = busyFromEvents(events);
  const { blocks, busy } = applyDemand(baseBlocks, baseBusy, demand, weekStartKey);
  const proposal = proposeSchedule(blocks, busy, { weekStartKey });
  return { proposal, busyCount: busy.length, blockCount: blocks.length };
}
