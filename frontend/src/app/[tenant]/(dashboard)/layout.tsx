import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { listRelationshipTypes } from "@/lib/relationship-types/server";
import { listMainStages } from "@/lib/main-stages/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { DialogProvider } from "@/components/providers/DialogProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { tenant: string };
}) {
  const [session, relationshipTypes, mainStages] = await Promise.all([
    getServerSession(params.tenant),
    listRelationshipTypes(),
    listMainStages(),
  ]);

  if (!session) {
    redirect(`/${params.tenant}`);
  }

  return (
    <DialogProvider>
      <ToastProvider>
        <div className="dashboard-layout">
          <Sidebar
            tenantSlug={params.tenant}
            permissions={session.permissions}
            relationshipTypes={relationshipTypes ?? []}
            mainStages={mainStages ?? []}
          />
          <div className="main-area">
            <TopBar
              tenantName={session.tenant.name}
              userDisplayName={session.user.displayName}
              tenantSlug={params.tenant}
            />
            <main className="dashboard-content">{children}</main>
          </div>
        </div>
      </ToastProvider>
    </DialogProvider>
  );
}
