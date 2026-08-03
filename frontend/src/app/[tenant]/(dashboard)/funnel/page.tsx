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

export default async function FunnelPage({ params }: { params: { tenant: string } }) {
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
    listDeals(),
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

  // Board columns are grouped by Main Stage here (the tenant-wide overview).
  const columns = (mainStages ?? []).map((stage) => ({
    id: stage.id,
    name: stage.name,
    position: stage.position,
  }));
  return (
    <FunnelSourceTabs
      dealSources={dealSources ?? []}
      columns={columns}
      mainStages={(mainStages ?? []).map((stage) => ({ id: stage.id, name: stage.name }))}
      subStages={(subStages ?? []).map((stage) => ({
        id: stage.id,
        name: stage.name,
        mainStageId: stage.mainStageId,
      }))}
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
      currentUserId={session?.user.id}
      permissions={session?.permissions ?? []}
    />
  );
}
