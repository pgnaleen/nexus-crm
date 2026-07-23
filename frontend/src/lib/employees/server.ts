import type { EmployeeDetailResponse, EmployeeListItemResponse, OrgChartEmployeeResponse } from "@orelia/common";
import { serverFetch } from "../api/server-client";

export function listEmployees(): Promise<EmployeeListItemResponse[] | null> {
  return serverFetch<EmployeeListItemResponse[]>("/employees");
}

// Story 1.7 -- Organization Chart data (non-exited employees + reporting edges).
export function fetchOrgChart(): Promise<OrgChartEmployeeResponse[] | null> {
  return serverFetch<OrgChartEmployeeResponse[]>("/employees/org-chart");
}

// Story 1.11 -- the caller's own employee record for My Profile (null when
// their account isn't linked to one; confidential fields always nulled
// server-side).
export function fetchMyEmployeeRecord(): Promise<EmployeeDetailResponse | null> {
  return serverFetch<EmployeeDetailResponse | null>("/employees/me");
}
