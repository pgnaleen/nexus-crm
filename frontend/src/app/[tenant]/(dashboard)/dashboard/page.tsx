import { DashboardWidgetGrid, type WidgetEntry } from "@/components/widgets/DashboardWidgetGrid";
import { buildLayoutFromDefinitions, filterWidgetsByPermissions } from "@/components/widgets/widget-registry";
import { getServerSession } from "@/lib/auth/session";
import { hasAnyPermissionForPrefix } from "@/lib/permissions";

export default async function DashboardPage({ params }: { params: { tenant: string } }) {
  const session = await getServerSession(params.tenant);
  const permitted = filterWidgetsByPermissions(session?.permissions ?? [], hasAnyPermissionForPrefix);

  const widgets: Record<string, WidgetEntry> = Object.fromEntries(
    permitted.map((w) => [w.key, { label: w.label, node: w.node }]),
  );
  const defaultLayout = buildLayoutFromDefinitions(permitted);

  return <DashboardWidgetGrid key={session?.tenant.id ?? "none"} widgets={widgets} defaultLayout={defaultLayout} />;
}

