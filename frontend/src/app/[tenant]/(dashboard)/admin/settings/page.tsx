import { SYSTEM_TENANT_SLUG } from "@orelia/common";
import { getServerSession } from "@/lib/auth/session";
import { PageTabs } from "@/components/ui/PageTabs";
import { BackupsWidget } from "./_components/BackupsWidget";
import { ActivityLogWidget } from "./_components/activity-log/ActivityLogWidget";

// Backups and Activity Log ("Audits") live together under one "Settings"
// sidebar entry as tabs, rather than each getting its own top-level nav
// item -- see Sidebar.tsx's ADMIN_ITEMS. Audits is still mock-first (see
// ActivityLogWidget's own comment); Backups is the existing, already-real
// feature, unchanged, just relocated into this shared page.
export default async function SettingsPage({ params }: { params: { tenant: string } }) {
  const session = await getServerSession(params.tenant);
  const permissions = session?.permissions ?? [];
  // Genuine System-tenant session only -- never act-as-tenant. See
  // ActivityLogWidget's isPlatformSession comment for why this is a
  // separate concept from the existing TenantActingAsSwitcher mechanism.
  const isPlatformSession = session?.tenant.slug === SYSTEM_TENANT_SLUG && !session?.actingTenant;
  const currentTenantId = session?.tenant.id ?? "";

  return (
    <div className="flex flex-col">
      <div className="mb-6 flex flex-col">
        <h1 className="m-0 mb-0.5 text-[26px] font-bold text-crm-text">Settings</h1>
      </div>

      <PageTabs
        tabs={[
          { id: "backups", label: "Backups", panel: <BackupsWidget permissions={permissions} /> },
          {
            id: "audits",
            label: "Audits",
            panel: (
              <ActivityLogWidget permissions={permissions} isPlatformSession={isPlatformSession} currentTenantId={currentTenantId} />
            ),
          },
        ]}
      />
    </div>
  );
}
