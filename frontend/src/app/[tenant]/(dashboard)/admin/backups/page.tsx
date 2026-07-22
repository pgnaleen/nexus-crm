import { getServerSession } from "@/lib/auth/session";
import { BackupsWidget } from "./_components/BackupsWidget";

export default async function BackupsManagementPage({
  params,
}: {
  params: { tenant: string };
}) {
  const session = await getServerSession(params.tenant);

  return <BackupsWidget permissions={session?.permissions ?? []} />;
}
