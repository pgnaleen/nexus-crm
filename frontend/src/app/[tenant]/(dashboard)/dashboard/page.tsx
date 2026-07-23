import type { Layout } from "react-grid-layout";
import { DashboardWidgetGrid, type WidgetEntry } from "@/components/widgets/DashboardWidgetGrid";
import { getDummyStatWidgetEntries, DUMMY_STAT_CARD_KEYS } from "@/components/widgets/dummyStatCards";
import { DealsBySourceStackedBarWidget } from "@/components/widgets/DealsBySourceStackedBarWidget";
import { DealsByStageChartWidget } from "@/components/widgets/DealsByStageChartWidget";
import { RevenueTrendChartWidget } from "@/components/widgets/RevenueTrendChartWidget";
import { SalesFunnelDiagramWidget } from "@/components/widgets/SalesFunnelDiagramWidget";
import { TaskCompletionDonutWidget } from "@/components/widgets/TaskCompletionDonutWidget";
import { TeamPerformanceRadarWidget } from "@/components/widgets/TeamPerformanceRadarWidget";
import { TenantGrowthChartWidget } from "@/components/widgets/TenantGrowthChartWidget";
import { UsersByRoleChartWidget } from "@/components/widgets/UsersByRoleChartWidget";

// Stat cards: 2 grid cols wide, 2 rows tall, 6 per row (12-col grid).
const STAT_CARD_COLS = 6;
const statCardLayout: Layout = DUMMY_STAT_CARD_KEYS.map((key, index) => ({
  i: key,
  x: (index % STAT_CARD_COLS) * 2,
  y: Math.floor(index / STAT_CARD_COLS) * 2,
  w: 2,
  h: 2,
}));
const statRows = Math.ceil(DUMMY_STAT_CARD_KEYS.length / STAT_CARD_COLS);
const chartsStartY = statRows * 2;

// Charts/diagrams: 6 grid cols wide, 3 rows tall, 2 per row.
const chartKeys = [
  "tenantGrowth",
  "usersByRole",
  "dealsByStage",
  "revenueTrend",
  "teamPerformance",
  "taskCompletion",
  "dealsBySource",
  "salesFunnel",
];
const CHART_COLS = 2;
const chartLayout: Layout = chartKeys.map((key, index) => ({
  i: key,
  x: (index % CHART_COLS) * 6,
  y: chartsStartY + Math.floor(index / CHART_COLS) * 3,
  w: 6,
  h: 3,
}));

const defaultLayout: Layout = [...statCardLayout, ...chartLayout];

export default function DashboardPage() {
  const widgets: Record<string, WidgetEntry> = {
    ...getDummyStatWidgetEntries(),
    tenantGrowth: { label: "Tenant Growth", node: <TenantGrowthChartWidget /> },
    usersByRole: { label: "Users by Role", node: <UsersByRoleChartWidget /> },
    dealsByStage: { label: "Deals by Stage", node: <DealsByStageChartWidget /> },
    revenueTrend: { label: "Revenue Trend", node: <RevenueTrendChartWidget /> },
    teamPerformance: { label: "Team Performance", node: <TeamPerformanceRadarWidget /> },
    taskCompletion: { label: "Task Completion", node: <TaskCompletionDonutWidget /> },
    dealsBySource: { label: "Deals by Source", node: <DealsBySourceStackedBarWidget /> },
    salesFunnel: { label: "Sales Funnel", node: <SalesFunnelDiagramWidget /> },
  };

  return <DashboardWidgetGrid widgets={widgets} defaultLayout={defaultLayout} />;
}
