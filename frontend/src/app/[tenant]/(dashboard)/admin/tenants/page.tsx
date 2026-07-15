import { getServerSession } from "@/lib/auth/session";
import { listIndustries, listPlans, listTenants } from "@/lib/tenants/server";
import { TenantsTableWidget } from "@/components/widgets/TenantsTableWidget";

export default async function TenantsManagementPage({
  params,
}: {
  params: { tenant: string };
}) {
  const [session, tenants, plans, industries] = await Promise.all([
    getServerSession(params.tenant),
    listTenants(),
    listPlans(),
    listIndustries(),
  ]);

  return (
    <div className="tenant-management-page">
      <TenantsTableWidget
        tenants={tenants ?? []}
        plans={plans ?? []}
        industries={industries ?? []}
        permissions={session?.permissions ?? []}
      />
    </div>
  );
}
