import { PERMISSIONS } from "@orelia/common";
import { getServerSession } from "@/lib/auth/session";
import { CertifiedSearchWidget } from "./_components/CertifiedSearchWidget";

export default async function CertifiedEmployeesPage({
  params,
}: {
  params: { tenant: string };
}) {
  const session = await getServerSession(params.tenant);
  const canView = session?.permissions.includes(PERMISSIONS.EMPLOYEES_VIEW) ?? false;

  return <CertifiedSearchWidget key={session?.tenant.id ?? "none"} canView={canView} />;
}
