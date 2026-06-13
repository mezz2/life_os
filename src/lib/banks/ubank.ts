import { BankAdapter, CanonicalTxn, cleanDescription, parseAmount, parseDate } from "./types";

// UBank CSV export.
// Headers: Date and time, Description, Debit, Credit, From account, To account,
//          Payment type, Category, Receipt number, Transaction ID
// Date is "HH:MM dd-mm-yy" e.g. "17:28 03-06-26". Amounts are "$15.64".
function parseUbankDate(s: string | undefined): Date {
  if (!s) return new Date(NaN);
  const m = s.match(/(\d{1,2})-(\d{1,2})-(\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return new Date(Date.UTC(year, +m[2] - 1, +m[1]));
  }
  return parseDate(s);
}

export const ubankAdapter: BankAdapter = {
  id: "ubank",
  label: "UBank",

  detect(headers) {
    const h = headers.map((x) => x.toLowerCase().trim());
    let score = 0;
    if (h.some((x) => x.startsWith("date"))) score += 0.3;
    if (h.includes("description")) score += 0.2;
    if (h.includes("debit") && h.includes("credit")) score += 0.3;
    if (h.includes("from account") || h.includes("to account")) score += 0.3;
    if (h.includes("transaction id")) score += 0.1;
    return Math.min(score, 0.98);
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

      const dateStr = get(["date and time", "date"]);
      const desc = (get(["description", "narrative", "details"]) ?? "").replace(/\\+$/, "").trim();
      const debit = parseAmount(get(["debit"]));
      const credit = parseAmount(get(["credit"]));
      const single = get(["amount"]);

      const date = parseUbankDate(dateStr);
      if (isNaN(date.getTime()) || !desc) continue;

      let amount: number;
      if (single !== undefined && single !== "") amount = parseAmount(single);
      else amount = credit ? Math.abs(credit) : -Math.abs(debit);
      if (amount === 0) continue;

      out.push({
        date,
        amount,
        rawDescription: desc,
        description: cleanDescription(desc),
      });
    }
    return out;
  },
};
