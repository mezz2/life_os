import { PageHeader } from "@/components/ui";
import { TransactionsClient } from "@/components/TransactionsClient";
import { getCategoryTree } from "@/lib/queries";
import { db } from "@/lib/db";
import { monthKey } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const [tree, accounts, txnDates] = await Promise.all([
    getCategoryTree(),
    db.account.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, institution: true } }),
    db.transaction.findMany({ select: { date: true }, orderBy: { date: "desc" }, take: 5000 }),
  ]);

  const months = [...new Set(txnDates.map((t) => monthKey(t.date)))].sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle="Import, search, filter and categorise every dollar"
      />
      <TransactionsClient tree={tree} accounts={accounts} months={months} />
    </div>
  );
}
