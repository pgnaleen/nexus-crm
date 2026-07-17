import { notFound } from "next/navigation";
import { FunnelSourceTabs } from "@/components/funnel/FunnelSourceTabs";
import { listDealSources } from "@/lib/deal-sources/server";
import { listMainStages } from "@/lib/main-stages/server";
import { listSubStages } from "@/lib/sub-stages/server";

export default async function MainStageDealsPage({
  params,
}: {
  params: { tenant: string; id: string };
}) {
  const [dealSources, mainStages, subStages] = await Promise.all([
    listDealSources(),
    listMainStages(),
    listSubStages(),
  ]);

  const mainStage = (mainStages ?? []).find((stage) => stage.id === params.id);

  // If the ID in the URL is invalid or the stage was deleted, show a 404 page.
  if (!mainStage) {
    notFound();
  }

  const columns = (subStages ?? [])
    .filter((stage) => stage.mainStageId === params.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((stage) => ({ id: stage.id, name: stage.name }));

  return (
    <FunnelSourceTabs
      dealSources={dealSources ?? []}
      columns={columns}
      title={mainStage.name}
      subtitle={
        columns.length === 0
          ? "No sub stages exist yet for this stage. Add one under Administration > Sub Stages."
          : `Track deals moving through ${mainStage.name}'s sub stages`
      }
    />
  );
}
