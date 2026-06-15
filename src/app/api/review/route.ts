import { NextRequest, NextResponse } from "next/server";
import { generateAndStore } from "@/lib/review-server";

// Generate (and persist) the weekly review digest for the given week (default: this week).
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { weekStart?: string };
  const { digest, weekStart } = await generateAndStore(body.weekStart);
  return NextResponse.json({ ok: true, weekStart, digest });
}
