import { SYSTEM_TENANT_SLUG } from "@orelia/common";
import { getServerSession } from "@/lib/auth/session";
import { listDealSources } from "@/lib/deal-sources/server";
import { listTenants } from "@/lib/tenants/server";
import { DealSourcesWidget } from "./_components/DealSourcesWidget";

export default async function DealSourcesPage({ params }: { params: { tenant: string } }) {
  const [session, dealSources] = await Promise.all([
    getServerSession(params.tenant),
    listDealSources(),
  ]);

  const isPlatformSession = session?.tenant.slug === SYSTEM_TENANT_SLUG;

  // Only System-tenant sessions can manage items for other tenants.
  const tenants = isPlatformSession ? await listTenants() : null;

  // Force a full remount when the acting-as scope changes.
  const scopeKey = session?.actingTenant?.id ?? session?.tenant.id ?? "none";

  return (
    <DealSourcesWidget
      key={scopeKey}
      dealSources={dealSources ?? []}
      permissions={session?.permissions ?? []}
      currentTenantId={session?.tenant.id ?? ""}
      isPlatformSession={isPlatformSession}
      tenants={tenants ?? []}
      actingTenant={session?.actingTenant ?? null}
    />
  );
}
