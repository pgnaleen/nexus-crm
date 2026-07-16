import { SYSTEM_TENANT_SLUG } from "@orelia/common";
import { getServerSession } from "@/lib/auth/session";
import { listUsers } from "@/lib/users/server";
import { listTenants } from "@/lib/tenants/server";
import { UsersTableWidget } from "@/components/widgets/UsersTableWidget";

export default async function UsersPage({ params }: { params: { tenant: string } }) {
  const [session, users] = await Promise.all([getServerSession(params.tenant), listUsers()]);
  const isPlatformSession = session?.tenant.slug === SYSTEM_TENANT_SLUG;

  // Only a System-tenant session can create users for other tenants -- skip
  // the extra request entirely rather than fetch data this session can't use.
  const tenants = isPlatformSession ? await listTenants() : null;

  // Force a full remount (rather than a prop update) whenever the ambient
  // data scope changes -- otherwise UsersTableWidget's useState(initialUsers)
  // keeps stale data across a router.refresh() when acting-as-tenant switches.
  const scopeKey = session?.actingTenant?.id ?? session?.tenant.id ?? "none";

  return (
    <UsersTableWidget
      key={scopeKey}
      users={users ?? []}
      permissions={session?.permissions ?? []}
      currentTenantId={session?.tenant.id ?? ""}
      isPlatformSession={isPlatformSession}
      tenants={tenants ?? []}
      actingTenant={session?.actingTenant ?? null}
    />
  );
}
