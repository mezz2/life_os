import Papa from "papaparse";
import { BankAdapter, CanonicalTxn } from "./types";
import { cbaAdapter } from "./cba";
import { westpacAdapter } from "./westpac";
import { ubankAdapter } from "./ubank";
import { wiseAdapter } from "./wise";

export const ADAPTERS: BankAdapter[] = [cbaAdapter, westpacAdapter, ubankAdapter, wiseAdapter];

export function getAdapter(id: string): BankAdapter | undefined {
  return ADAPTERS.find((a) => a.id === id);
}

export type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
};

// Parse raw CSV text. Handles headerless CBA files by synthesising column keys.
export function parseCsv(text: string): ParsedCsv {
  const trimmed = text.replace(/^﻿/, "");
  const firstLine = trimmed.split(/\r?\n/)[0] ?? "";
  // Heuristic: a header row contains alphabetic column names, not a leading date.
  const looksHeaderless = /^\s*"?\d{1,2}\/\d{1,2}\/\d{2,4}/.test(firstLine);

  const result = Papa.parse<Record<string, string>>(trimmed, {
    header: !looksHeaderless,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (looksHeaderless) {
    const arr = result.data as unknown as string[][];
    const rows = arr.map((cells) => {
      const o: Record<string, string> = {};
      cells.forEach((c, i) => (o[`col${i}`] = c));
      return o;
    });
    return { headers: [], rows };
  }

  const rows = (result.data as Record<string, string>[]).filter((r) =>
    Object.values(r).some((v) => v && String(v).trim() !== ""),
  );
  return { headers: result.meta.fields ?? [], rows };
}

// Pick the most likely bank for a parsed CSV.
export function detectBank(parsed: ParsedCsv): { adapter: BankAdapter; confidence: number } | null {
  let best: { adapter: BankAdapter; confidence: number } | null = null;
  for (const adapter of ADAPTERS) {
    const confidence = adapter.detect(parsed.headers, parsed.rows.slice(0, 5));
    if (!best || confidence > best.confidence) best = { adapter, confidence };
  }
  return best && best.confidence > 0 ? best : null;
}

export function normalise(parsed: ParsedCsv, adapterId: string): CanonicalTxn[] {
  const adapter = getAdapter(adapterId);
  if (!adapter) return [];
  return adapter
    .parse(parsed.rows)
    .filter((t) => !isNaN(t.date.getTime()) && t.amount !== 0);
}
