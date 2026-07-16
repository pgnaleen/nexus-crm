import { FunnelSourceTabs } from "@/components/funnel/FunnelSourceTabs";
import { listDealSources } from "@/lib/deal-sources/server";
import { listMainStages } from "@/lib/main-stages/server";

export default async function FunnelPage() {
  const [dealSources, mainStages] = await Promise.all([
    listDealSources(),
    listMainStages(),
  ]);
  
  return <FunnelSourceTabs dealSources={dealSources ?? []} mainStages={mainStages ?? []} />;
}
