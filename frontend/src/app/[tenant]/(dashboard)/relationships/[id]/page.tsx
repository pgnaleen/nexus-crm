import { notFound } from "next/navigation";
import { SYSTEM_TENANT_SLUG } from "@orelia/common";
import { getServerSession } from "@/lib/auth/session";
import { listRelationshipTypes } from "@/lib/relationship-types/server";
import { listRelationshipParties } from "@/lib/relationship-parties/server";
import { listTenants } from "@/lib/tenants/server";
import { listCompaniesPicker, listEmployeesPicker, listIndustries } from "@/lib/pickers/server";
import { RelationshipViewWidget } from "./_components/RelationshipViewWidget";

export default async function RelationshipTypePage({
  params,
}: {
  params: { tenant: string; id: string };
}) {
  const [session, allTypes, parties, industries, employees, companies] = await Promise.all([
    getServerSession(params.tenant),
    listRelationshipTypes(),
    listRelationshipParties(params.id),
    listIndustries(),
    listEmployeesPicker(),
    listCompaniesPicker(),
  ]);

  // Fetch all relationship types and find the one that matches the URL ID.
  const relationshipType = allTypes?.find((t) => t.id === params.id);

  // If the ID in the URL is invalid or the type was deleted, show a 404 page.
  if (!relationshipType) {
    notFound();
  }

  const isPlatformSession = session?.tenant.slug === SYSTEM_TENANT_SLUG;

  // Only System-tenant sessions can act as other tenants.
  const tenants = isPlatformSession ? await listTenants() : null;

  // Force a full remount when the acting-as scope changes.
  const scopeKey = session?.actingTenant?.id ?? session?.tenant.id ?? "none";

  return (
    <RelationshipViewWidget
      key={scopeKey}
      relationshipType={relationshipType}
      parties={parties ?? []}
      permissions={session?.permissions ?? []}
      currentTenantId={session?.tenant.id ?? ""}
      isPlatformSession={isPlatformSession}
      tenants={tenants ?? []}
      actingTenant={session?.actingTenant ?? null}
      industries={industries ?? []}
      employees={employees ?? []}
      companies={companies ?? []}
    />
  );
}
