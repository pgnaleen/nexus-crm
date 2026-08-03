// A single grid item's saved position -- deliberately not importing
// react-grid-layout's own `LayoutItem` type here, since @orelia/common has no
// dependency on frontend-only packages.
export interface DashboardLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardPreferenceResponse {
  visibleWidgetKeys: string[];
  layout: DashboardLayoutItem[];
}

export interface UpdateDashboardPreferenceRequest {
  visibleWidgetKeys: string[];
  layout: DashboardLayoutItem[];
}
