import { SYSTEM_TENANT_SLUG } from "@orelia/common";
import { getServerSession } from "@/lib/auth/session";
import { listMainStages } from "@/lib/main-stages/server";
import { listTenants } from "@/lib/tenants/server";
import { MainStagesWidget } from "./_components/MainStagesWidget";

export default async function MainStagesPage({ params }: { params: { tenant: string } }) {
  const [session, mainStages] = await Promise.all([
    getServerSession(params.tenant),
    listMainStages(),
  ]);

  const isPlatformSession = session?.tenant.slug === SYSTEM_TENANT_SLUG;

  // Only System-tenant sessions can manage items for other tenants.
  const tenants = isPlatformSession ? await listTenants() : null;

  // Force a full remount when the acting-as scope changes.
  const scopeKey = session?.actingTenant?.id ?? session?.tenant.id ?? "none";

  return (
    <MainStagesWidget
      key={scopeKey}
      mainStages={mainStages ?? []}
      permissions={session?.permissions ?? []}
      currentTenantId={session?.tenant.id ?? ""}
      isPlatformSession={isPlatformSession}
      tenants={tenants ?? []}
      actingTenant={session?.actingTenant ?? null}
    />
  );
}
