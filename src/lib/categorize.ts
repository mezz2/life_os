import { createHash } from "crypto";
import { db } from "./db";

export function txnHash(accountId: string, date: Date, amount: number, rawDescription: string): string {
  const key = `${accountId}|${date.toISOString().slice(0, 10)}|${amount.toFixed(2)}|${rawDescription.toLowerCase().trim()}`;
  return createHash("sha1").update(key).digest("hex");
}

type RuleLite = { pattern: string; matchType: string; subcategoryId: string; priority: number };

function ruleMatches(rule: RuleLite, text: string): boolean {
  const t = text.toLowerCase();
  const p = rule.pattern.toLowerCase();
  switch (rule.matchType) {
    case "equals":
      return t === p;
    case "startsWith":
      return t.startsWith(p);
    case "regex":
      try {
        return new RegExp(rule.pattern, "i").test(text);
      } catch {
        return false;
      }
    default:
      return t.includes(p);
  }
}

// Apply DB rules to a description. Returns subcategoryId or null.
export function categorizeWithRules(
  rules: RuleLite[],
  description: string,
  raw: string,
): string | null {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  const haystack = `${description} ${raw}`;
  for (const rule of sorted) {
    if (ruleMatches(rule, haystack)) return rule.subcategoryId;
  }
  return null;
}

export async function loadRules(): Promise<RuleLite[]> {
  return db.categoryRule.findMany({
    select: { pattern: true, matchType: true, subcategoryId: true, priority: true },
  });
}

// ---- Claude fallback for descriptions no rule matched ----

export type SubcatOption = { id: string; label: string; category: string; group: string | null };

// Ask Claude to map unknown descriptions → subcategory id (batched).
// Returns map of description -> subcategoryId. Silent no-op if no API key.
const CHUNK = 50;

export async function categorizeWithClaude(
  descriptions: string[],
  options: SubcatOption[],
): Promise<Record<string, string>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || descriptions.length === 0) return {};

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });
  const validIds = new Set(options.map((o) => o.id));

  const catalogue = options
    .map((o) => `${o.id}\t${o.category} › ${o.group ? o.group + " › " : ""}${o.label}`)
    .join("\n");

  // Chunk so big imports don't blow the token budget; run chunks concurrently.
  const chunks: string[][] = [];
  for (let i = 0; i < descriptions.length; i += CHUNK) chunks.push(descriptions.slice(i, i + CHUNK));

  async function runChunk(chunk: string[]): Promise<Record<string, string>> {
    const list = chunk.map((d, i) => `${i}. ${d}`).join("\n");
    const prompt = `You are categorising Australian bank transactions for a personal finance app.
Match each transaction description to the single best subcategory ID from the catalogue.
If nothing fits well, use the subcategory whose label is "Uncategorised".

CATALOGUE (id<TAB>path):
${catalogue}

TRANSACTIONS:
${list}

Respond with ONLY a JSON object mapping each transaction index (as string) to a subcategory id, e.g. {"0":"abc123","1":"def456"}. No prose.`;
    try {
      const msg = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });
      const text = msg.content
        .filter((c) => c.type === "text")
        .map((c) => (c as { text: string }).text)
        .join("");
      const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      const parsed = JSON.parse(json) as Record<string, string>;
      const out: Record<string, string> = {};
      for (const [idx, id] of Object.entries(parsed)) {
        const i = Number(idx);
        if (validIds.has(id) && chunk[i] !== undefined) out[chunk[i]] = id;
      }
      return out;
    } catch (e) {
      console.error("Claude categorisation chunk failed:", e);
      return {};
    }
  }

  const results = await Promise.all(chunks.map(runChunk));
  return Object.assign({}, ...results);
}
