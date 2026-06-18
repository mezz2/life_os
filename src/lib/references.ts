// Knowledge garden — pure helpers (Phase 10). No DB; works on plain strings so
// the API route and page can share URL handling and source inference.

// Strip whitespace; prepend https:// when a bare host is given. Returns null for
// empty input so the column stays nullable.
export function normaliseUrl(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  // looks like a domain (has a dot, no spaces) — assume https
  if (/^[^\s.]+\.[^\s]+$/.test(t)) return `https://${t}`;
  return t;
}

// Parse the hostname from a URL, dropping a leading "www.". Null if unparseable.
export function hostOf(url: string | null | undefined): string | null {
  const u = normaliseUrl(url);
  if (!u) return null;
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

const SOURCE_PATTERNS: Array<[RegExp, string]> = [
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, "youtube"],
  [/(^|\.)spotify\.com$/, "spotify"],
  [/(^|\.)open\.spotify\.com$/, "spotify"],
  [/(^|\.)pubmed\.ncbi\.nlm\.nih\.gov$|(^|\.)ncbi\.nlm\.nih\.gov$/, "pubmed"],
  [/(^|\.)docs\.google\.com$|(^|\.)drive\.google\.com$/, "drive"],
  [/(^|\.)github\.com$/, "github"],
  [/(^|\.)wikipedia\.org$/, "wikipedia"],
  [/(^|\.)substack\.com$/, "substack"],
  [/(^|\.)medium\.com$/, "medium"],
  [/(^|\.)arxiv\.org$/, "arxiv"],
];

// Best-effort provider label for a URL, falling back to the bare host, then "web".
export function inferSource(url: string | null | undefined): string {
  const host = hostOf(url);
  if (!host) return "web";
  for (const [re, label] of SOURCE_PATTERNS) {
    if (re.test(host)) return label;
  }
  return host;
}

// Group references by source for the garden's section view, sorted by count desc.
export function groupBySource<T extends { source: string | null }>(refs: T[]): Array<{ source: string; items: T[] }> {
  const map = new Map<string, T[]>();
  for (const r of refs) {
    const key = r.source || "web";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return [...map.entries()]
    .map(([source, items]) => ({ source, items }))
    .sort((a, b) => b.items.length - a.items.length || a.source.localeCompare(b.source));
}
