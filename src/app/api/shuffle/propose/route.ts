import { NextRequest, NextResponse } from "next/server";
import { startOfWeekKey, todayKey } from "@/lib/habits";
import { buildProposal } from "@/lib/shuffle-server";
import { parseDemand } from "@/lib/shuffle-ai";

// Propose a reflowed week. Optionally interprets free-text demand via Claude,
// then runs the pure solver. Never writes anything — propose, then apply.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { weekStart?: string; demandText?: string };
  const weekStart = startOfWeekKey(
    body.weekStart && /^\d{4}-\d{2}-\d{2}$/.test(body.weekStart) ? body.weekStart : todayKey(),
  );
  const { demand, note } = await parseDemand(body.demandText ?? "");
  const { proposal, busyCount, blockCount } = await buildProposal(weekStart, demand);
  return NextResponse.json({ ok: true, weekStart, proposal, demand, demandNote: note, busyCount, blockCount });
}
