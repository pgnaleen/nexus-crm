import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getPublicTenant } from "@/lib/tenants/server";
import { LoginForm } from "./LoginForm";

export default async function TenantEntryPage({ params }: { params: { tenant: string } }) {
  const session = await getServerSession(params.tenant);
  if (session) {
    redirect(`/${params.tenant}/dashboard`);
  }

  const tenant = await getPublicTenant(params.tenant);
  const tenantName = tenant?.name ?? params.tenant;

  return <LoginForm tenantSlug={params.tenant} tenantName={tenantName} />;
}
