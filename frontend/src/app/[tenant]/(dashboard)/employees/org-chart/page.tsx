import { getServerSession } from "@/lib/auth/session";
import { fetchOrgChart } from "@/lib/employees/server";
import { listDepartmentsPicker } from "@/lib/pickers/server";
import { OrgChartWidget } from "./_components/OrgChartWidget";

export default async function OrgChartPage({
  params,
}: {
  params: { tenant: string };
}) {
  const [session, employees, departments] = await Promise.all([
    getServerSession(params.tenant),
    fetchOrgChart(),
    // Story 1.8 -- edit mode's draggable Department anchors.
    listDepartmentsPicker(),
  ]);

  // The Company root node is named after the tenant -- when a platform admin
  // is acting as another tenant, that tenant's name is the org being viewed.
  const companyName = session?.actingTenant?.name ?? session?.tenant.name ?? "";

  return (
    <OrgChartWidget
      key={session?.tenant.id ?? "none"}
      companyName={companyName}
      employees={employees ?? []}
      departments={departments ?? []}
      permissions={session?.permissions ?? []}
    />
  );
}
