import { FunnelSourceTabs } from "@/components/funnel/FunnelSourceTabs";
import { getServerSession } from "@/lib/auth/session";
import { listDealSources } from "@/lib/deal-sources/server";
import { listDeals } from "@/lib/deals/server";
import { listMainStages } from "@/lib/main-stages/server";
import {
  listCompaniesPicker,
  listCompanyCountries,
  listContactsPicker,
  listDealCustomerParties,
  listDealPartnerParties,
  listDepartmentsPicker,
  listEmployeesPicker,
  listIndustries,
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
    countries,
    relationshipTypes,
    industries,
    customerParties,
    partnerParties,
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
    listCompanyCountries(),
    listRelationshipTypes(),
    listIndustries(),
    listDealCustomerParties(),
    listDealPartnerParties(),
  ]);

  // Board columns stay grouped by Main Stage here (the tenant-wide overview),
  // but a deal's currentStageId must be a real Sub Stage -- so the Add Deal
  // dialog gets its own stage list, labeled with the owning Main Stage since
  // it spans every stage in the funnel rather than just one.
  const columns = (mainStages ?? []).map((stage) => ({
    id: stage.id,
    name: stage.name,
    position: stage.position,
  }));
  const mainStageNameById = new Map((mainStages ?? []).map((stage) => [stage.id, stage.name]));
  // Position first by Main Stage sequence, then by Sub Stage sequence within
  // it -- Sub Stages restart their own sortOrder per Main Stage, so sorting
  // by sortOrder alone would not put the true first stage of the funnel first.
  const mainStagePositionById = new Map((mainStages ?? []).map((stage) => [stage.id, stage.position]));
  const stageOptions = (subStages ?? [])
    .slice()
    .sort((a, b) => {
      const posDiff = (mainStagePositionById.get(a.mainStageId) ?? 0) - (mainStagePositionById.get(b.mainStageId) ?? 0);
      return posDiff !== 0 ? posDiff : a.sortOrder - b.sortOrder;
    })
    .map((stage) => ({
      id: stage.id,
      name: `${mainStageNameById.get(stage.mainStageId) ?? "Unknown"} › ${stage.name}`,
      mainStageId: stage.mainStageId,
    }));

  return (
    <FunnelSourceTabs
      dealSources={dealSources ?? []}
      columns={columns}
      stageOptions={stageOptions}
      companies={companies ?? []}
      employees={employees ?? []}
      contacts={contacts ?? []}
      departments={departments ?? []}
      countries={countries ?? []}
      relationshipTypes={relationshipTypes ?? []}
      industries={industries ?? []}
      customerParties={customerParties ?? { configured: false, companies: [], contacts: [] }}
      partnerParties={partnerParties ?? { configured: false, companies: [], contacts: [] }}
      initialDeals={deals ?? []}
      currentUserId={session?.user.id}
      permissions={session?.permissions ?? []}
    />
  );
}
