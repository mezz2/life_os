import { BankAdapter, CanonicalTxn, cleanDescription, parseAmount, parseDate, toAud } from "./types";

// Wise transaction export (multi-currency — used for the Japan trip in JPY).
// Headers include: ID, Status, Direction (IN/OUT/NEUTRAL), Created on, Finished on,
//   Source amount (after fees), Source currency, Target name, Target amount (after fees),
//   Target currency, Reference, Category, Note
// Amounts are converted to AUD via FX_TO_AUD so they slot into the AUD budget.
export const wiseAdapter: BankAdapter = {
  id: "wise",
  label: "Wise",

  detect(headers) {
    const h = headers.map((x) => x.toLowerCase().trim());
    let score = 0;
    if (h.includes("direction")) score += 0.35;
    if (h.some((x) => x.includes("source amount"))) score += 0.35;
    if (h.includes("exchange rate")) score += 0.2;
    if (h.some((x) => x.includes("target currency"))) score += 0.1;
    return Math.min(score, 0.98);
  },

  parse(rows) {
    const out: CanonicalTxn[] = [];
    for (const row of rows) {
      const keys = Object.keys(row);
      const get = (name: string) => {
        const k = keys.find((x) => x.toLowerCase().trim() === name);
        return k ? row[k] : undefined;
      };

      const status = (get("status") ?? "").toUpperCase();
      if (status && status !== "COMPLETED") continue;

      const direction = (get("direction") ?? "").toUpperCase();
      const date = parseDate(get("finished on") || get("created on"));
      if (isNaN(date.getTime())) continue;

      // Prefer source side (what left/entered the account); fall back to target.
      const srcAmt = parseAmount(get("source amount (after fees)"));
      const srcCcy = get("source currency") ?? "";
      const tgtAmt = parseAmount(get("target amount (after fees)"));
      const tgtCcy = get("target currency") ?? "";
      const useSrc = srcAmt !== 0;
      const rawAmt = useSrc ? srcAmt : tgtAmt;
      const ccy = (useSrc ? srcCcy : tgtCcy) || "AUD";
      if (rawAmt === 0) continue;

      const magnitude = toAud(Math.abs(rawAmt), ccy);
      const amount = direction === "OUT" ? -magnitude : magnitude;

      const counterparty = get("target name") || get("source name") || get("reference") || "Wise transfer";
      const note = `${ccy} ${Math.abs(rawAmt).toLocaleString()}`;

      out.push({
        date,
        amount,
        rawDescription: counterparty,
        description: cleanDescription(counterparty),
        note,
      });
    }
    return out;
  },
};
