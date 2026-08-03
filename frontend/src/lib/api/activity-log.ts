import type {
  ActivityLogFilterOptionsResponse,
  ActivityLogQuery,
  AuditLogEntryResponse,
  AuthEventResponse,
  PaginatedResponse,
} from "@orelia/common";
import { apiFetch } from "./client";

function toQueryString(query: ActivityLogQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function getAuditLog(query: ActivityLogQuery): Promise<PaginatedResponse<AuditLogEntryResponse>> {
  return apiFetch<PaginatedResponse<AuditLogEntryResponse>>(`/activity-log/audit${toQueryString(query)}`);
}

export function getAuthEvents(query: ActivityLogQuery): Promise<PaginatedResponse<AuthEventResponse>> {
  return apiFetch<PaginatedResponse<AuthEventResponse>>(`/activity-log/auth${toQueryString(query)}`);
}

export function getActivityLogFilterOptions(
  query: Pick<ActivityLogQuery, "from" | "to" | "allTenants" | "tenantId">,
): Promise<ActivityLogFilterOptionsResponse> {
  return apiFetch<ActivityLogFilterOptionsResponse>(`/activity-log/filters${toQueryString(query)}`);
}
