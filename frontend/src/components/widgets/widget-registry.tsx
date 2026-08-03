import type { ReactNode } from "react";
import type { Layout, LayoutItem } from "react-grid-layout";
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
import { DUMMY_STAT_CARD_KEYS, getDummyStatWidgetEntries } from "@/components/widgets/dummyStatCards";

// Single source of truth for every dashboard widget: what it renders, where it defaults to
// sitting on the grid, and which section(s) a viewer needs access to before it's offered to
// them at all. "Access to a section" mirrors the same rule Sidebar.tsx uses for nav items --
// ANY permission under the resource prefix, not one exact permission key (see
// hasAnyPermissionForPrefix in @/lib/permissions). A widget blending more than one section's
// data (e.g. Partners Insight needs Deals + Relationship) requires ALL listed prefixes.
export interface WidgetDefinition {
  key: string;
  label: string;
  node: ReactNode;
  requiredSectionPrefixes: string[];
  defaultPosition: Omit<LayoutItem, "i">;
}

const STAT_CARD_ENTRIES = getDummyStatWidgetEntries();

const STAT_CARD_DEFINITIONS: WidgetDefinition[] = DUMMY_STAT_CARD_KEYS.map((key, index) => {
  const entry = STAT_CARD_ENTRIES[key]!;
  return {
    key,
    label: entry.label,
    node: entry.node,
    requiredSectionPrefixes: ["deals"],
    defaultPosition: { x: index * 2, y: 0, w: 2, h: 2 },
  };
});

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  ...STAT_CARD_DEFINITIONS,

  // CEO Macro View
  {
    key: "revenueForecast",
    label: "Revenue Forecast",
    node: <RevenueForecastChartWidget />,
    requiredSectionPrefixes: ["deals"],
    defaultPosition: { x: 0, y: 2, w: 8, h: 4 },
  },
  {
    key: "targetRevenue",
    label: "Target vs Actual",
    node: <TargetRevenueGaugeWidget />,
    requiredSectionPrefixes: ["deals"],
    defaultPosition: { x: 8, y: 2, w: 4, h: 4 },
  },

  // Pipeline Deep Dive
  {
    key: "dealsByStage",
    label: "Deal Count by Stage",
    node: <DealsByStageChartWidget />,
    requiredSectionPrefixes: ["deals"],
    defaultPosition: { x: 0, y: 6, w: 6, h: 3 },
  },
  {
    key: "valueByStage",
    label: "Value by Stage",
    node: <ValueByStageChartWidget />,
    requiredSectionPrefixes: ["deals"],
    defaultPosition: { x: 6, y: 6, w: 6, h: 3 },
  },

  // Slicing metrics
  {
    key: "dealsBySource",
    label: "Deals by Source",
    node: <DealsBySourceStackedBarWidget />,
    requiredSectionPrefixes: ["deals"],
    defaultPosition: { x: 0, y: 9, w: 4, h: 3 },
  },
  {
    key: "dealsByDepartment",
    label: "Department Wise Deals",
    node: <DealsByDepartmentChartWidget />,
    requiredSectionPrefixes: ["deals"],
    defaultPosition: { x: 4, y: 9, w: 4, h: 3 },
  },
  {
    key: "partnersInsight",
    label: "Partners Insight",
    node: <PartnersInsightWidget />,
    requiredSectionPrefixes: ["deals", "relationship"],
    defaultPosition: { x: 8, y: 9, w: 4, h: 3 },
  },

  // Risk & Win/Loss Analysis
  {
    key: "atRiskDeals",
    label: "At-Risk Deals",
    node: <AtRiskDealsListWidget />,
    requiredSectionPrefixes: ["deals"],
    defaultPosition: { x: 0, y: 12, w: 6, h: 4 },
  },
  {
    key: "winLossReasons",
    label: "Win/Loss Reasons",
    node: <WinLossReasonsChartWidget />,
    requiredSectionPrefixes: ["deals"],
    defaultPosition: { x: 6, y: 12, w: 6, h: 4 },
  },

  // Additional widgets not yet placed on the default dashboard -- available from the
  // "Add widgets" panel, gated the same way.
  {
    key: "revenueTrend",
    label: "Revenue Trend",
    node: <RevenueTrendChartWidget />,
    requiredSectionPrefixes: ["deals"],
    defaultPosition: { x: 0, y: 16, w: 6, h: 4 },
  },
  {
    key: "salesFunnel",
    label: "Sales Funnel",
    node: <SalesFunnelDiagramWidget />,
    requiredSectionPrefixes: ["deals"],
    defaultPosition: { x: 6, y: 16, w: 6, h: 4 },
  },
  {
    key: "teamPerformance",
    label: "Team Performance",
    node: <TeamPerformanceRadarWidget />,
    requiredSectionPrefixes: ["deals", "teams"],
    defaultPosition: { x: 0, y: 20, w: 4, h: 3 },
  },
  {
    key: "tenantGrowth",
    label: "Tenant Growth",
    node: <TenantGrowthChartWidget />,
    requiredSectionPrefixes: ["tenants"],
    defaultPosition: { x: 4, y: 20, w: 4, h: 3 },
  },
  {
    key: "usersByRole",
    label: "Users by Role",
    node: <UsersByRoleChartWidget />,
    requiredSectionPrefixes: ["users"],
    defaultPosition: { x: 8, y: 20, w: 4, h: 3 },
  },
  {
    key: "taskCompletion",
    label: "Task Completion",
    node: <TaskCompletionDonutWidget />,
    // Priority Tracker is auth-only today (see Sidebar.tsx) -- no section permission exists
    // to gate this on yet, so it's visible to every authenticated user.
    requiredSectionPrefixes: [],
    defaultPosition: { x: 0, y: 23, w: 4, h: 3 },
  },
];

export function filterWidgetsByPermissions(
  permissions: string[],
  hasAnyPermissionForPrefix: (permissions: string[], prefix: string | string[]) => boolean,
): WidgetDefinition[] {
  return WIDGET_REGISTRY.filter((widget) =>
    widget.requiredSectionPrefixes.every((prefix) => hasAnyPermissionForPrefix(permissions, prefix)),
  );
}

export function buildLayoutFromDefinitions(definitions: WidgetDefinition[]): Layout {
  return definitions.map((d) => ({ i: d.key, ...d.defaultPosition }));
}
