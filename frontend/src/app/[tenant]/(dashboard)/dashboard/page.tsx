import { DashboardWidgetGrid } from "@/components/widgets/DashboardWidgetGrid";
import {
  buildLayoutFromDefinitions,
  buildWidgetNodes,
  filterWidgetsByPermissions,
  getRequiredBundles,
} from "@/components/widgets/widget-registry";
import { getServerSession } from "@/lib/auth/session";
import {
  fetchDashboardPreferences,
  fetchDealsMetrics,
  fetchPartnersMetrics,
  fetchTasksMetrics,
  fetchTenantsMetrics,
  fetchUsersMetrics,
} from "@/lib/dashboard/server";
import { hasAnyPermissionForPrefix } from "@/lib/permissions";

const DEFAULT_CURRENCY = "USD";

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: { tenant: string };
  searchParams: { currency?: string };
}) {
  const [session, preferences] = await Promise.all([
    getServerSession(params.tenant),
    fetchDashboardPreferences(),
  ]);
  const permitted = filterWidgetsByPermissions(session?.permissions ?? [], hasAnyPermissionForPrefix);
  const required = getRequiredBundles(permitted);

  // URL param (the user just picked a new one in the selector) wins over the saved preference,
  // which wins over the default -- see DashboardWidgetGrid's handleCurrencyChange.
  const currency = searchParams.currency ?? preferences?.currency ?? DEFAULT_CURRENCY;

  // Never fetch a bundle the permitted widget list has no use for -- avoids a guaranteed 403
  // (the user lacks the section permission) or a wasted call (the only permitted widget needing
  // that section is still a dummy-data placeholder, e.g. Team Performance).
  const [deals, partners, tenants, users, tasks] = await Promise.all([
    required.deals ? fetchDealsMetrics(currency) : Promise.resolve(undefined),
    required.partners ? fetchPartnersMetrics() : Promise.resolve(undefined),
    required.tenants ? fetchTenantsMetrics() : Promise.resolve(undefined),
    required.users ? fetchUsersMetrics() : Promise.resolve(undefined),
    required.tasks ? fetchTasksMetrics() : Promise.resolve(undefined),
  ]);

  const widgets = buildWidgetNodes(permitted, { deals, partners, tenants, users, tasks });
  const defaultLayout = buildLayoutFromDefinitions(permitted);

  return (
    <DashboardWidgetGrid
      key={session?.tenant.id ?? "none"}
      widgets={widgets}
      defaultLayout={defaultLayout}
      initialPreferences={preferences}
      currency={currency}
    />
  );
}
