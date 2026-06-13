import { BankAdapter, CanonicalTxn, cleanDescription, parseAmount, parseDate } from "./types";

// Westpac CSV export.
// Headers: Bank Account, Date, Narrative, Debit Amount, Credit Amount, Balance, Categories, Serial
export const westpacAdapter: BankAdapter = {
  id: "westpac",
  label: "Westpac",

  detect(headers) {
    const h = headers.map((x) => x.toLowerCase().trim());
    let score = 0;
    if (h.includes("narrative")) score += 0.4;
    if (h.includes("debit amount") || h.includes("credit amount")) score += 0.4;
    if (h.includes("bank account")) score += 0.2;
    return Math.min(score, 0.95);
  },

  parse(rows) {
    const out: CanonicalTxn[] = [];
    for (const row of rows) {
      const keys = Object.keys(row);
      const get = (names: string[]) => {
        for (const n of names) {
          const k = keys.find((x) => x.toLowerCase().trim() === n);
          if (k) return row[k];
        }
        return undefined;
      };

      const dateStr = get(["date"]);
      const desc = get(["narrative", "description"]);
      const debit = parseAmount(get(["debit amount", "debit"]));
      const credit = parseAmount(get(["credit amount", "credit"]));
      const single = get(["amount"]);

      const date = parseDate(dateStr);
      if (isNaN(date.getTime()) || !desc) continue;

      // Debit columns are positive magnitudes → make them negative.
      let amount: number;
      if (single !== undefined) amount = parseAmount(single);
      else amount = credit ? Math.abs(credit) : -Math.abs(debit);

      out.push({
        date,
        amount,
        rawDescription: String(desc).trim(),
        description: cleanDescription(String(desc)),
      });
    }
    return out;
  },
};
