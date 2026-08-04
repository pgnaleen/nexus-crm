import type {
  DashboardPreferenceResponse,
  DealsMetricsResponse,
  PartnersMetricsResponse,
  TasksMetricsResponse,
  TenantsMetricsResponse,
  UsersMetricsResponse,
} from "@orelia/common";
import { serverFetch } from "../api/server-client";

export function fetchDashboardPreferences(): Promise<DashboardPreferenceResponse | null> {
  return serverFetch<DashboardPreferenceResponse | null>("/dashboard/preferences");
}

export function fetchDealsMetrics(currency: string): Promise<DealsMetricsResponse | null> {
  return serverFetch<DealsMetricsResponse>(`/dashboard/metrics/deals?currency=${encodeURIComponent(currency)}`);
}

export function fetchPartnersMetrics(): Promise<PartnersMetricsResponse | null> {
  return serverFetch<PartnersMetricsResponse>("/dashboard/metrics/partners");
}

export function fetchTenantsMetrics(): Promise<TenantsMetricsResponse | null> {
  return serverFetch<TenantsMetricsResponse>("/dashboard/metrics/tenants");
}

export function fetchUsersMetrics(): Promise<UsersMetricsResponse | null> {
  return serverFetch<UsersMetricsResponse>("/dashboard/metrics/users");
}

export function fetchTasksMetrics(): Promise<TasksMetricsResponse | null> {
  return serverFetch<TasksMetricsResponse>("/dashboard/metrics/tasks");
}
