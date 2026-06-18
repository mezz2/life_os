import type { Demand } from "./shuffle";

// Turn free-text weekly demand ("crazy work week, big deadline Thursday, protect
// Sunday, skip the nice-to-haves") into a structured Demand the pure solver can
// act on. Returns {} when there's no API key or on any failure, so the shuffle
// still runs (just without demand adjustments). The interpretation itself lives
// in applyDemand() and is unit-tested; this only does text -> JSON.
export async function parseDemand(text: string): Promise<{ demand: Demand; note: string | null }> {
  const trimmed = text.trim();
  if (!trimmed) return { demand: {}, note: null };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { demand: {}, note: "Connect an Anthropic API key to interpret weekly demands." };

  const prompt = `You translate a person's free-text description of their week into a strict JSON schedule-demand object for a calendar shuffling engine.

Weekday numbers: 0=Sunday,1=Monday,2=Tuesday,3=Wednesday,4=Thursday,5=Friday,6=Saturday.
Minutes are minutes-from-midnight (e.g. 9am=540, 6pm=1080).

Return ONLY minified JSON with this shape (omit keys that don't apply):
{"protectedDays":[0],"dropFluid":true,"extraBusy":[{"dow":4,"startMin":540,"endMin":1080}]}
- protectedDays: days they want kept entirely free.
- dropFluid: true if they want to shed nice-to-haves under load.
- extraBusy: heavier-than-usual commitments to block out.

Their week: "${trimmed.replace(/"/g, "'")}"`;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { text: string }).text)
      .join("")
      .trim();
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json) as Demand;
    return { demand: sanitise(parsed), note: null };
  } catch (e) {
    console.error("Demand parse failed:", e);
    return { demand: {}, note: "Couldn't interpret that — proceeding without demand adjustments." };
  }
}

// Defend against the model returning out-of-range values.
function sanitise(d: Demand): Demand {
  const out: Demand = {};
  if (Array.isArray(d.protectedDays)) out.protectedDays = d.protectedDays.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  if (typeof d.dropFluid === "boolean") out.dropFluid = d.dropFluid;
  if (Array.isArray(d.extraBusy)) {
    out.extraBusy = d.extraBusy
      .filter((b) => Number.isInteger(b?.dow) && b.dow >= 0 && b.dow <= 6)
      .map((b) => ({ dow: b.dow, startMin: Math.max(0, Math.min(1440, b.startMin | 0)), endMin: Math.max(0, Math.min(1440, b.endMin | 0)) }))
      .filter((b) => b.endMin > b.startMin);
  }
  return out;
}
