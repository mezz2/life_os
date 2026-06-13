import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseCsv, detectBank, normalise } from "@/lib/banks";
import {
  loadRules,
  categorizeWithRules,
  categorizeWithClaude,
  txnHash,
  type SubcatOption,
} from "@/lib/categorize";

async function subcatOptions(): Promise<SubcatOption[]> {
  const subs = await db.subcategory.findMany({
    include: { category: { select: { name: true } } },
  });
  return subs.map((s) => ({ id: s.id, label: s.name, category: s.category.name, group: s.group }));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action as "preview" | "commit";

  if (action === "preview") {
    const { text } = body as { text: string };
    const parsed = parseCsv(text);
    const detected = detectBank(parsed);
    if (!detected) {
      return NextResponse.json({ error: "Could not detect bank format", headers: parsed.headers });
    }
    const canon = normalise(parsed, detected.adapter.id);

    // Categorise: rules first, Claude for the rest.
    const rules = await loadRules();
    const options = await subcatOptions();
    const optById = new Map(options.map((o) => [o.id, o]));

    const assigned: (string | null)[] = canon.map((t) =>
      categorizeWithRules(rules, t.description, t.rawDescription),
    );

    const unresolvedIdx = assigned
      .map((a, i) => (a ? -1 : i))
      .filter((i) => i >= 0);
    const uniqueDesc = [...new Set(unresolvedIdx.map((i) => canon[i].description))];

    if (uniqueDesc.length) {
      const aiMap = await categorizeWithClaude(uniqueDesc, options);
      for (const i of unresolvedIdx) {
        const id = aiMap[canon[i].description];
        if (id) assigned[i] = id;
      }
    }

    const rows = canon.map((t, i) => {
      const subId = assigned[i];
      const opt = subId ? optById.get(subId) : null;
      return {
        date: t.date.toISOString().slice(0, 10),
        description: t.description,
        rawDescription: t.rawDescription,
        amount: t.amount,
        note: t.note ?? null,
        subcategoryId: subId ?? null,
        subcategoryName: opt ? `${opt.category} › ${opt.label}` : null,
        needsReview: !subId,
      };
    });

    return NextResponse.json({
      detected: { id: detected.adapter.id, label: detected.adapter.label, confidence: detected.confidence },
      rowCount: rows.length,
      rows,
    });
  }

  if (action === "commit") {
    const { filename, accountId, rows } = body as {
      filename: string;
      accountId: string;
      rows: {
        date: string;
        description: string;
        rawDescription: string;
        amount: number;
        note?: string | null;
        subcategoryId: string | null;
        needsReview: boolean;
      }[];
    };

    if (!accountId || !Array.isArray(rows)) {
      return NextResponse.json({ error: "Missing accountId or rows" }, { status: 400 });
    }

    const batch = await db.importBatch.create({
      data: { filename: filename ?? "import.csv", accountId, rowCount: rows.length },
    });

    let added = 0;
    let skipped = 0;
    for (const r of rows) {
      const date = new Date(r.date + "T00:00:00Z");
      const hash = txnHash(accountId, date, r.amount, r.rawDescription);
      try {
        await db.transaction.create({
          data: {
            date,
            description: r.description,
            rawDescription: r.rawDescription,
            amount: r.amount,
            direction: r.amount < 0 ? "debit" : "credit",
            accountId,
            subcategoryId: r.subcategoryId,
            source: "import",
            importBatchId: batch.id,
            hash,
            notes: r.note ?? null,
            needsReview: r.needsReview,
          },
        });
        added++;
      } catch {
        skipped++; // unique hash collision = duplicate
      }
    }

    await db.importBatch.update({
      where: { id: batch.id },
      data: { addedCount: added, skippedCount: skipped },
    });

    return NextResponse.json({ ok: true, added, skipped, batchId: batch.id });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
