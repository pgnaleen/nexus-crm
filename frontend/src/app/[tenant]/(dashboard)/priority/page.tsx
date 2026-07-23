import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { listPriorityTasks } from "@/lib/priority-tasks/server";
import { PriorityBoard } from "./_components/PriorityBoard";

// Gated by authentication only, no RBAC permission check -- every user
// manages their own personal board, same access pattern as My Profile.
export default async function PriorityPage({ params }: { params: { tenant: string } }) {
  const session = await getServerSession(params.tenant);
  if (!session) {
    redirect(`/${params.tenant}`);
  }

  const tasks = await listPriorityTasks();

  return <PriorityBoard initialTasks={tasks ?? []} />;
}
