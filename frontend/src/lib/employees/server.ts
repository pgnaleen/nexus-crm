import type { EmployeeListItemResponse } from "@orelia/common";
import { serverFetch } from "../api/server-client";

export function listEmployees(): Promise<EmployeeListItemResponse[] | null> {
  return serverFetch<EmployeeListItemResponse[]>("/employees");
}
