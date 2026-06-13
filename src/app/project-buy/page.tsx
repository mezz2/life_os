import { PageHeader } from "@/components/ui";
import { ProjectBuyClient } from "@/components/ProjectBuyClient";
import { getBuyActuals } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ProjectBuyPage() {
  const actuals = await getBuyActuals();
  return (
    <div>
      <PageHeader
        title="Project BUY"
        subtitle="What it takes to buy a first home — modelled against your real savings"
      />
      <ProjectBuyClient actuals={actuals} />
    </div>
  );
}
