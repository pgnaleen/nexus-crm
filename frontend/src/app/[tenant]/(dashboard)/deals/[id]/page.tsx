import { notFound } from "next/navigation";
import { FunnelSourceTabs } from "@/components/funnel/FunnelSourceTabs";
import { getServerSession } from "@/lib/auth/session";
import { listDealSources } from "@/lib/deal-sources/server";
import { listDeals, listDealPartnerLinks, listDealRoles } from "@/lib/deals/server";
import { listMainStages } from "@/lib/main-stages/server";
import {
  listCompaniesPicker,
  listContactsPicker,
  listDealCustomerParties,
  listDealPartnerParties,
  listDepartmentsPicker,
  listEmployeesPicker,
  listIndustries,
  listUsersPicker,
} from "@/lib/pickers/server";
import { listRelationshipTypes } from "@/lib/relationship-types/server";
import { listSubStages } from "@/lib/sub-stages/server";

export default async function MainStageDealsPage({
  params,
}: {
  params: { tenant: string; id: string };
}) {
  const [
    session,
    dealSources,
    mainStages,
    subStages,
    deals,
    companies,
    employees,
    contacts,
    departments,
    relationshipTypes,
    industries,
    customerParties,
    partnerParties,
    partnerLinks,
    dealRoles,
    users,
  ] = await Promise.all([
    getServerSession(params.tenant),
    listDealSources(),
    listMainStages(),
    listSubStages(),
    listDeals(params.id),
    listCompaniesPicker(),
    listEmployeesPicker(),
    listContactsPicker(),
    listDepartmentsPicker(),
    listRelationshipTypes(),
    listIndustries(),
    listDealCustomerParties(),
    listDealPartnerParties(),
    listDealPartnerLinks(),
    listDealRoles(),
    listUsersPicker(),
  ]);

  const mainStage = (mainStages ?? []).find((stage) => stage.id === params.id);

  // If the ID in the URL is invalid or the stage was deleted, show a 404 page.
  if (!mainStage) {
    notFound();
  }

  const columns = (subStages ?? [])
    .filter((stage) => stage.mainStageId === params.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((stage) => ({ id: stage.id, name: stage.name, mainStageId: stage.mainStageId }));

  return (
    <FunnelSourceTabs
      dealSources={dealSources ?? []}
      columns={columns}
      stageField="currentStageName"
      mainStages={(mainStages ?? []).map((stage) => ({ id: stage.id, name: stage.name }))}
      subStages={(subStages ?? []).map((stage) => ({
        id: stage.id,
        name: stage.name,
        mainStageId: stage.mainStageId,
      }))}
      defaultMainStageId={params.id}
      companies={companies ?? []}
      employees={employees ?? []}
      contacts={contacts ?? []}
      departments={departments ?? []}
      relationshipTypes={relationshipTypes ?? []}
      industries={industries ?? []}
      customerParties={customerParties ?? { configured: false, companies: [], contacts: [] }}
      partnerParties={partnerParties ?? { configured: false, companies: [], contacts: [] }}
      partnerLinks={partnerLinks ?? []}
      dealRoles={dealRoles ?? []}
      users={users ?? []}
      initialDeals={deals ?? []}
      title={mainStage.name}
      subtitle={
        columns.length === 0
          ? "No sub stages exist yet for this stage. Add one under Administration > Sub Stages."
          : `Track deals moving through ${mainStage.name}'s sub stages`
      }
      currentUserId={session?.user.id}
      permissions={session?.permissions ?? []}
    />
  );
}
