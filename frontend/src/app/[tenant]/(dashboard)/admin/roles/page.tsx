import { SYSTEM_TENANT_SLUG } from "@orelia/common";
import { getServerSession } from "@/lib/auth/session";
import { listResources, listRoles } from "@/lib/roles/server";
import { listTenants } from "@/lib/tenants/server";
import { RolesTableWidget } from "@/components/widgets/RolesTableWidget";

export default async function RolesManagementPage({
  params,
}: {
  params: { tenant: string };
}) {
  const [session, roles, resources] = await Promise.all([
    getServerSession(params.tenant),
    listRoles(),
    listResources(),
  ]);
  const isPlatformSession = session?.tenant.slug === SYSTEM_TENANT_SLUG;

  const tenants = isPlatformSession ? await listTenants() : null;

  // See users/page.tsx -- forces a remount on tenant-scope change so
  // RolesTableWidget's useState(initialRoles) doesn't go stale across
  // an acting-as-tenant router.refresh().
  const scopeKey = session?.actingTenant?.id ?? session?.tenant.id ?? "none";

  return (
    <RolesTableWidget
      key={scopeKey}
      roles={roles ?? []}
      resources={resources ?? []}
      permissions={session?.permissions ?? []}
      currentTenantId={session?.tenant.id ?? ""}
      isPlatformSession={isPlatformSession}
      tenants={tenants ?? []}
      actingTenant={session?.actingTenant ?? null}
    />
  );
}
