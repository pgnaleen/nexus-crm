import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { listRelationshipTypes } from "@/lib/relationship-types/server";
import { listMainStages } from "@/lib/main-stages/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { DialogProvider } from "@/components/providers/DialogProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { TabSyncListener } from "@/components/providers/TabSyncListener";

// Same gradient+dot technique as the login page (frontend/src/app/[tenant]/page.module.css),
// but anchored to --color-crm-shell (the documented navy shell token) instead of the login
// page's own separate blue hex values, and with NO red anywhere in the background -- per
// CLAUDE.md's rule, red stays confined to buttons/active-nav-item/badges/focus rings, never the
// shell background itself. Every color here is a var() reference into globals.css's @theme
// block, not a raw hex value -- changing the shell color only ever requires editing that block.
const SHELL_BG =
  "relative bg-crm-shell [background-image:radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(160deg,var(--color-crm-shell-gradient-start)_0%,var(--color-crm-shell)_55%,var(--color-crm-shell-gradient-end)_100%)] [background-size:22px_22px,100%_100%]";

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
        <TabSyncListener />
        <div className={`flex h-screen overflow-hidden pt-4 pr-4 ${SHELL_BG}`}>
          <div className="pointer-events-none absolute -top-[120px] -right-[100px] h-[420px] w-[420px] rounded-full bg-crm-shell-gradient-end/30 blur-[80px]" />
          <div className="pointer-events-none absolute -bottom-[120px] -left-[100px] h-[360px] w-[360px] rounded-full bg-crm-shell/30 blur-[80px]" />
          <Sidebar
            tenantSlug={params.tenant}
            permissions={session.permissions}
            relationshipTypes={relationshipTypes ?? []}
            mainStages={mainStages ?? []}
          />
          <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-t-3xl">
            <TopBar
              tenantName={session.tenant.name}
              userDisplayName={session.user.displayName}
              tenantSlug={params.tenant}
            />
            <main className="flex-1 overflow-y-auto bg-crm-bg p-6">{children}</main>
          </div>
        </div>
      </ToastProvider>
    </DialogProvider>
  );
}
