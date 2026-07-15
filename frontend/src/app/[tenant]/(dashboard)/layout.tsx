import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getMockRelationshipTypes, getMockFunnelStages } from "@/lib/api/mock";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { tenant: string };
}) {
  const [session, relationshipTypes, funnelStages] = await Promise.all([
    getServerSession(params.tenant),
    getMockRelationshipTypes(),
    getMockFunnelStages(),
  ]);

  if (!session) {
    redirect(`/${params.tenant}`);
  }

  return (
    <div className="dashboard-layout">
      <Sidebar 
        tenantSlug={params.tenant} 
        permissions={session.permissions} 
        relationshipTypes={relationshipTypes}
        funnelStages={funnelStages}
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
  );
}
