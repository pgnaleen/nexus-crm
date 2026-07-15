import { getServerSession } from "@/lib/auth/session";
import { listResources, listRoles } from "@/lib/roles/server";
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

  return (
    <RolesTableWidget
      roles={roles ?? []}
      resources={resources ?? []}
      permissions={session?.permissions ?? []}
    />
  );
}
