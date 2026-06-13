import { BankAdapter, CanonicalTxn, cleanDescription, parseAmount, parseDate } from "./types";

// Commonwealth Bank (CBA) NetBank CSV export.
// Classic format has NO header row, columns: Date, Amount, Description, Balance
//   e.g.  13/06/2026,"-15.00","EFTPOS WOOLWORTHS","+1234.56"
// Newer exports include headers (Date, Amount, Description, Balance).
export const cbaAdapter: BankAdapter = {
  id: "cba",
  label: "CBA (Commonwealth Bank)",

  detect(headers, rows) {
    const h = headers.map((x) => x.toLowerCase());
    const hasHeaders =
      h.includes("amount") && h.includes("description") && (h.includes("date") || h.includes("balance"));
    if (hasHeaders) return 0.8;
    // Headerless: first row looks like date,amount,text,balance
    const first = rows[0];
    if (!first) return 0;
    const cells = Object.values(first);
    const looksHeaderless =
      cells.length >= 3 &&
      /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(String(cells[0] ?? "")) &&
      /-?\$?[\d,.]+/.test(String(cells[1] ?? ""));
    return looksHeaderless ? 0.6 : 0;
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

      let dateStr = get(["date"]);
      let amountStr = get(["amount"]);
      let desc = get(["description", "transaction details", "narrative"]);

      // Headerless fallback: positional Date, Amount, Description, Balance
      if (!dateStr && !amountStr) {
        const cells = Object.values(row);
        dateStr = String(cells[0] ?? "");
        amountStr = String(cells[1] ?? "");
        desc = String(cells[2] ?? "");
      }

      const date = parseDate(dateStr);
      const amount = parseAmount(amountStr);
      if (isNaN(date.getTime()) || !desc) continue;
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
