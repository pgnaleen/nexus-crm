import type { ReactNode } from "react";
import type { Layout, LayoutItem } from "react-grid-layout";
import type {
  DealsMetricsResponse,
  PartnersMetricsResponse,
  TasksMetricsResponse,
  TenantsMetricsResponse,
  UsersMetricsResponse,
} from "@orelia/common";
import { AtRiskDealsListWidget } from "@/components/widgets/AtRiskDealsListWidget";
import { DealsByDepartmentChartWidget } from "@/components/widgets/DealsByDepartmentChartWidget";
import { DealsBySourceStackedBarWidget } from "@/components/widgets/DealsBySourceStackedBarWidget";
import { DealsByStageChartWidget } from "@/components/widgets/DealsByStageChartWidget";
import { PartnersInsightWidget } from "@/components/widgets/PartnersInsightWidget";
import { RevenueForecastChartWidget } from "@/components/widgets/RevenueForecastChartWidget";
import { RevenueTrendChartWidget } from "@/components/widgets/RevenueTrendChartWidget";
import { SalesFunnelDiagramWidget } from "@/components/widgets/SalesFunnelDiagramWidget";
import { TargetRevenueGaugeWidget } from "@/components/widgets/TargetRevenueGaugeWidget";
import { TaskCompletionDonutWidget } from "@/components/widgets/TaskCompletionDonutWidget";
import { TeamPerformanceRadarWidget } from "@/components/widgets/TeamPerformanceRadarWidget";
import { TenantGrowthChartWidget } from "@/components/widgets/TenantGrowthChartWidget";
import { UsersByRoleChartWidget } from "@/components/widgets/UsersByRoleChartWidget";
import { ValueByStageChartWidget } from "@/components/widgets/ValueByStageChartWidget";
import { WinLossReasonsChartWidget } from "@/components/widgets/WinLossReasonsChartWidget";
import { getStatWidgetEntries, STAT_CARD_KEYS } from "@/components/widgets/dummyStatCards";

// Single source of truth for every dashboard widget's static metadata: where it defaults to
// sitting on the grid, and which section(s) a viewer needs access to before it's offered to them
// at all. "Access to a section" mirrors the same rule Sidebar.tsx uses for nav items -- ANY
// permission under the resource prefix, not one exact permission key (see
// hasAnyPermissionForPrefix in @/lib/permissions). A widget blending more than one section's data
// (e.g. Partners Insight needs Deals + Relationship) requires ALL listed prefixes.
//
// Deliberately split from the actual React node: permission filtering (this metadata) has to
// happen BEFORE the metrics bundles are fetched, so dashboard/page.tsx knows which bundles are
// even worth fetching -- see buildWidgetNodes below for the second half, which turns a permitted
// widget list + the fetched metrics into actual rendered nodes.
export interface WidgetMetadata {
  key: string;
  label: string;
  requiredSectionPrefixes: string[];
  defaultPosition: Omit<LayoutItem, "i">;
}

const STAT_CARD_METADATA: WidgetMetadata[] = STAT_CARD_KEYS.map((key, index) => ({
  key,
  label: key,
  requiredSectionPrefixes: ["deals"],
  defaultPosition: { x: index * 2, y: 0, w: 2, h: 2 },
}));

export const WIDGET_METADATA: WidgetMetadata[] = [
  ...STAT_CARD_METADATA,

  // CEO Macro View
  { key: "revenueForecast", label: "Revenue Forecast", requiredSectionPrefixes: ["deals"], defaultPosition: { x: 0, y: 2, w: 8, h: 4 } },
  { key: "targetRevenue", label: "Target vs Actual", requiredSectionPrefixes: ["deals"], defaultPosition: { x: 8, y: 2, w: 4, h: 4 } },

  // Pipeline Deep Dive
  { key: "dealsByStage", label: "Deal Count by Stage", requiredSectionPrefixes: ["deals"], defaultPosition: { x: 0, y: 6, w: 6, h: 3 } },
  { key: "valueByStage", label: "Value by Stage", requiredSectionPrefixes: ["deals"], defaultPosition: { x: 6, y: 6, w: 6, h: 3 } },

  // Slicing metrics
  { key: "dealsBySource", label: "Deals by Source", requiredSectionPrefixes: ["deals"], defaultPosition: { x: 0, y: 9, w: 4, h: 3 } },
  { key: "dealsByDepartment", label: "Department Wise Deals", requiredSectionPrefixes: ["deals"], defaultPosition: { x: 4, y: 9, w: 4, h: 3 } },
  { key: "partnersInsight", label: "Partners Insight", requiredSectionPrefixes: ["deals", "relationship"], defaultPosition: { x: 8, y: 9, w: 4, h: 3 } },

  // Risk & Win/Loss Analysis
  { key: "atRiskDeals", label: "At-Risk Deals", requiredSectionPrefixes: ["deals"], defaultPosition: { x: 0, y: 12, w: 6, h: 4 } },
  { key: "winLossReasons", label: "Win/Loss Reasons", requiredSectionPrefixes: ["deals"], defaultPosition: { x: 6, y: 12, w: 6, h: 4 } },

  // Additional widgets not yet placed on the default dashboard -- available from the
  // "Add widgets" panel, gated the same way.
  { key: "revenueTrend", label: "Revenue Trend", requiredSectionPrefixes: ["deals"], defaultPosition: { x: 0, y: 16, w: 6, h: 4 } },
  { key: "salesFunnel", label: "Sales Funnel", requiredSectionPrefixes: ["deals"], defaultPosition: { x: 6, y: 16, w: 6, h: 4 } },
  { key: "teamPerformance", label: "Team Performance", requiredSectionPrefixes: ["deals", "teams"], defaultPosition: { x: 0, y: 20, w: 4, h: 3 } },
  { key: "tenantGrowth", label: "Tenant Growth", requiredSectionPrefixes: ["tenants"], defaultPosition: { x: 4, y: 20, w: 4, h: 3 } },
  { key: "usersByRole", label: "Users by Role", requiredSectionPrefixes: ["users"], defaultPosition: { x: 8, y: 20, w: 4, h: 3 } },
  {
    key: "taskCompletion",
    label: "Task Completion",
    // Priority Tracker is auth-only today (see Sidebar.tsx) -- no section permission exists
    // to gate this on yet, so it's visible to every authenticated user.
    requiredSectionPrefixes: [],
    defaultPosition: { x: 0, y: 23, w: 4, h: 3 },
  },
];

export function filterWidgetsByPermissions(
  permissions: string[],
  hasAnyPermissionForPrefix: (permissions: string[], prefix: string | string[]) => boolean,
): WidgetMetadata[] {
  return WIDGET_METADATA.filter((widget) =>
    widget.requiredSectionPrefixes.every((prefix) => hasAnyPermissionForPrefix(permissions, prefix)),
  );
}

export function buildLayoutFromDefinitions(definitions: WidgetMetadata[]): Layout {
  return definitions.map((d) => ({ i: d.key, ...d.defaultPosition }));
}

// Which bundle(s) dashboard/page.tsx needs to fetch, given the already permission-filtered widget
// list -- explicit key lists rather than re-deriving from requiredSectionPrefixes, since three
// still-dummy widgets (targetRevenue, winLossReasons, teamPerformance) also require "deals"/
// "teams" for visibility gating but have no real bundle backing them yet, and fetching a bundle
// only to serve zero real widgets would be wasted.
const DEALS_BUNDLE_KEYS = [
  ...STAT_CARD_KEYS,
  "revenueForecast",
  "revenueTrend",
  "dealsByStage",
  "valueByStage",
  "dealsBySource",
  "dealsByDepartment",
  "atRiskDeals",
  "salesFunnel",
];
const PARTNERS_BUNDLE_KEYS = ["partnersInsight"];
const TENANTS_BUNDLE_KEYS = ["tenantGrowth"];
const USERS_BUNDLE_KEYS = ["usersByRole"];
const TASKS_BUNDLE_KEYS = ["taskCompletion"];

function permittedIncludesAny(permitted: WidgetMetadata[], keys: string[]): boolean {
  return permitted.some((w) => keys.includes(w.key));
}

export interface RequiredBundles {
  deals: boolean;
  partners: boolean;
  tenants: boolean;
  users: boolean;
  tasks: boolean;
}

export function getRequiredBundles(permitted: WidgetMetadata[]): RequiredBundles {
  return {
    deals: permittedIncludesAny(permitted, DEALS_BUNDLE_KEYS),
    partners: permittedIncludesAny(permitted, PARTNERS_BUNDLE_KEYS),
    tenants: permittedIncludesAny(permitted, TENANTS_BUNDLE_KEYS),
    users: permittedIncludesAny(permitted, USERS_BUNDLE_KEYS),
    tasks: permittedIncludesAny(permitted, TASKS_BUNDLE_KEYS),
  };
}

export interface DashboardMetricsBundle {
  deals?: DealsMetricsResponse | null;
  partners?: PartnersMetricsResponse | null;
  tenants?: TenantsMetricsResponse | null;
  users?: UsersMetricsResponse | null;
  tasks?: TasksMetricsResponse | null;
}

export interface WidgetEntry {
  label: string;
  node: ReactNode;
}

// Turns the permission-filtered widget list + the fetched metrics bundles into actual rendered
// nodes. Widgets with no real backing data yet (targetRevenue, winLossReasons, teamPerformance)
// keep rendering their own internal DUMMY_DATA -- untouched, no props.
export function buildWidgetNodes(
  permitted: WidgetMetadata[],
  metrics: DashboardMetricsBundle,
): Record<string, WidgetEntry> {
  const dealsCurrency = metrics.deals?.currency ?? "USD";
  const statCardEntries = metrics.deals ? getStatWidgetEntries(metrics.deals.statCards, dealsCurrency) : {};

  const nodeBuilders: Record<string, () => ReactNode> = {
    revenueForecast: () => <RevenueForecastChartWidget data={metrics.deals?.revenueForecast ?? []} currency={dealsCurrency} />,
    targetRevenue: () => <TargetRevenueGaugeWidget />,
    dealsByStage: () => <DealsByStageChartWidget data={metrics.deals?.dealsByStage ?? []} />,
    valueByStage: () => <ValueByStageChartWidget data={metrics.deals?.valueByStage ?? []} currency={dealsCurrency} />,
    dealsBySource: () => <DealsBySourceStackedBarWidget data={metrics.deals?.dealsBySource ?? []} />,
    dealsByDepartment: () => <DealsByDepartmentChartWidget data={metrics.deals?.dealsByDepartment ?? []} />,
    partnersInsight: () => <PartnersInsightWidget data={metrics.partners?.partnersInsight ?? []} />,
    atRiskDeals: () => <AtRiskDealsListWidget data={metrics.deals?.atRiskDeals ?? []} currency={dealsCurrency} />,
    winLossReasons: () => <WinLossReasonsChartWidget />,
    revenueTrend: () => <RevenueTrendChartWidget data={metrics.deals?.revenueForecast ?? []} currency={dealsCurrency} />,
    salesFunnel: () => <SalesFunnelDiagramWidget data={metrics.deals?.dealsByStage ?? []} />,
    teamPerformance: () => <TeamPerformanceRadarWidget />,
    tenantGrowth: () => <TenantGrowthChartWidget data={metrics.tenants?.tenantGrowth ?? []} />,
    usersByRole: () => <UsersByRoleChartWidget data={metrics.users?.usersByRole ?? []} />,
    taskCompletion: () => (
      <TaskCompletionDonutWidget
        data={metrics.tasks ?? { completedCount: 0, activeCount: 0, completionPercent: 0 }}
      />
    ),
  };

  const entries: Record<string, WidgetEntry> = {};
  for (const widget of permitted) {
    const statCardEntry = statCardEntries[widget.key];
    if (statCardEntry) {
      entries[widget.key] = statCardEntry;
      continue;
    }
    const build = nodeBuilders[widget.key];
    if (build) {
      entries[widget.key] = { label: widget.label, node: build() };
    }
  }
  return entries;
}
