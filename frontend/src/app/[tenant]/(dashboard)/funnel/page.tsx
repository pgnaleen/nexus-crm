import { FunnelSourceTabs } from "@/components/funnel/FunnelSourceTabs";
import { listDealSources } from "@/lib/deal-sources/server";
import { listMainStages } from "@/lib/main-stages/server";

export default async function FunnelPage() {
  const [dealSources, mainStages] = await Promise.all([
    listDealSources(),
    listMainStages(),
  ]);
  
  const columns = (mainStages ?? []).map((stage) => ({ id: stage.id, name: stage.name }));

  return <FunnelSourceTabs dealSources={dealSources ?? []} columns={columns} />;
}
