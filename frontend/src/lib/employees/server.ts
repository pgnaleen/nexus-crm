import type { EmployeeListItemResponse, OrgChartEmployeeResponse } from "@orelia/common";
import { serverFetch } from "../api/server-client";

export function listEmployees(): Promise<EmployeeListItemResponse[] | null> {
  return serverFetch<EmployeeListItemResponse[]>("/employees");
}

// Story 1.7 -- Organization Chart data (non-exited employees + reporting edges).
export function fetchOrgChart(): Promise<OrgChartEmployeeResponse[] | null> {
  return serverFetch<OrgChartEmployeeResponse[]>("/employees/org-chart");
}
