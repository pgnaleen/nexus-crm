import { SYSTEM_TENANT_SLUG } from "@orelia/common";
import { getServerSession } from "@/lib/auth/session";
import { listRelationshipTypes } from "@/lib/relationship-types/server";
import { listTenants } from "@/lib/tenants/server";
import { RelationshipTypesWidget } from "./_components/RelationshipTypesWidget";

export default async function RelationshipTypesPage({ params }: { params: { tenant: string } }) {
  const [session, relationshipTypes] = await Promise.all([
    getServerSession(params.tenant),
    listRelationshipTypes(),
  ]);

  const isPlatformSession = session?.tenant.slug === SYSTEM_TENANT_SLUG;

  // Only a System-tenant session can manage items for other tenants -- skip
  // the extra request entirely rather than fetch data this session can't use.
  const tenants = isPlatformSession ? await listTenants() : null;

  // Force a full remount (rather than a prop update) whenever the ambient
  // data scope changes -- otherwise the Widget's useState(initialData)
  // keeps stale data across a router.refresh() when acting-as-tenant switches.
  const scopeKey = session?.actingTenant?.id ?? session?.tenant.id ?? "none";

  return (
    <RelationshipTypesWidget
      key={scopeKey}
      relationshipTypes={relationshipTypes ?? []}
      permissions={session?.permissions ?? []}
      currentTenantId={session?.tenant.id ?? ""}
      isPlatformSession={isPlatformSession}
      tenants={tenants ?? []}
      actingTenant={session?.actingTenant ?? null}
    />
  );
}
