// Real backend data for dashboard widgets, bundled by permission section --
// see widget-registry.tsx's own grouping, which this mirrors 1:1. Every money
// field in DealsMetricsResponse is normalized server-side (via FxRatesService)
// into whichever currency the caller requested (?currency= on
// GET /dashboard/metrics/deals, default "USD") -- `currency` on the response
// itself says which one, so the frontend never has to guess or mix.

export interface DashboardStatCards {
  totalDeals: number;
  pipelineValue: number;
  winLossRatePercent: number;
  avgGpMarginPercent: number;
  salesVelocityDays: number;
}

export interface MonthlyRevenuePoint {
  month: string; // "YYYY-MM"
  actual: number;
  projected: number;
}

export interface StageCount {
  stageName: string;
  count: number;
}

export interface StageValue {
  stageName: string;
  value: number;
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
  value: number;
  daysStuck: number;
  stageName: string;
}

export interface DealsMetricsResponse {
  currency: string;
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
