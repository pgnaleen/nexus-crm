import { getServerSession } from "@/lib/auth/session";
import { listTeams } from "@/lib/teams/server";
import { TeamsTableWidget } from "@/components/layout/TeamsTableWidget";

export default async function TeamsManagementPage({ params }: { params: { tenant: string } }) {
  const [session, teams] = await Promise.all([getServerSession(params.tenant), listTeams()]);

  return <TeamsTableWidget teams={teams ?? []} permissions={session?.permissions ?? []} />;
}
