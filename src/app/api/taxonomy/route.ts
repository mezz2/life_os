import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { installStandardTaxonomy } from "@/lib/taxonomy";
import { loadRules, categorizeWithRules } from "@/lib/categorize";

// Install the standard category taxonomy + starter rules into a blank DB, then
// sweep any already-imported uncategorised transactions through the rules. This
// is what the empty-state "Set up standard categories" button calls, so a user
// who imported before setting up categories gets both the taxonomy *and* their
// existing transactions categorised (incl. internal transfers, which then drop
// out of the income/expense totals). Idempotent: safe to call repeatedly.
export async function POST() {
  const install = await installStandardTaxonomy(db);

  // Re-categorise existing uncategorised transactions against current rules.
  const rules = await loadRules();
  let categorised = 0;
  if (rules.length) {
    const pending = await db.transaction.findMany({
      where: { subcategoryId: null },
      select: { id: true, description: true, rawDescription: true },
    });
    for (const t of pending) {
      const subId = categorizeWithRules(rules, t.description, t.rawDescription);
      if (subId) {
        await db.transaction.update({
          where: { id: t.id },
          data: { subcategoryId: subId, needsReview: false },
        });
        categorised++;
      }
    }
  }

  return NextResponse.json({ ...install, recategorised: categorised });
}
