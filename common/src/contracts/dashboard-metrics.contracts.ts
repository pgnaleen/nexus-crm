// Real backend data for dashboard widgets, bundled by permission section --
// see widget-registry.tsx's own grouping, which this mirrors 1:1. All money
// fields are normalized to USD server-side via FxRatesService before they
// ever reach these shapes, so the frontend never mixes currencies.

export interface DashboardStatCards {
  totalDeals: number;
  pipelineValueUsd: number;
  winLossRatePercent: number;
  avgGpMarginPercent: number;
  salesVelocityDays: number;
}

export interface MonthlyRevenuePoint {
  month: string; // "YYYY-MM"
  actualUsd: number;
  projectedUsd: number;
}

export interface StageCount {
  stageName: string;
  count: number;
}

export interface StageValue {
  stageName: string;
  valueUsd: number;
}

export interface SourceMonthCount {
  month: string; // "YYYY-MM"
  sourceName: string;
  count: number;
}

export interface DepartmentCount {
  departmentName: string;
  count: number;
}

export interface AtRiskDealSummary {
  id: string;
  name: string;
  valueUsd: number;
  daysStuck: number;
  stageName: string;
}

export interface DealsMetricsResponse {
  statCards: DashboardStatCards;
  revenueForecast: MonthlyRevenuePoint[];
  dealsByStage: StageCount[];
  valueByStage: StageValue[];
  dealsBySource: SourceMonthCount[];
  dealsByDepartment: DepartmentCount[];
  atRiskDeals: AtRiskDealSummary[];
}

export interface PartnerCount {
  companyName: string;
  count: number;
}

export interface PartnersMetricsResponse {
  partnersInsight: PartnerCount[];
}

export interface TenantsMetricsResponse {
  tenantGrowth: { month: string; count: number }[];
}

export interface RoleCount {
  roleName: string;
  count: number;
}

export interface UsersMetricsResponse {
  usersByRole: RoleCount[];
}

export interface TasksMetricsResponse {
  completedCount: number;
  activeCount: number; // placed + delegated + accepted (archived excluded -- it's left the active board)
  completionPercent: number;
}
