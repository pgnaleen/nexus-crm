import type { CreateEmployeeRequest, EmployeeListItemResponse } from "@orelia/common";
import { apiFetch } from "./client";

export function createEmployee(payload: CreateEmployeeRequest): Promise<EmployeeListItemResponse> {
  return apiFetch<EmployeeListItemResponse>("/employees", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
