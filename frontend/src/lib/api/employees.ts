import type {
  CreateEmployeeRequest,
  EmployeeDetailResponse,
  EmployeeListItemResponse,
  UpdateEmployeeRequest,
} from "@orelia/common";
import { apiFetch } from "./client";

export function createEmployee(payload: CreateEmployeeRequest): Promise<EmployeeListItemResponse> {
  return apiFetch<EmployeeListItemResponse>("/employees", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateEmployee(id: string, payload: UpdateEmployeeRequest): Promise<EmployeeDetailResponse> {
  return apiFetch<EmployeeDetailResponse>(`/employees/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getEmployee(id: string): Promise<EmployeeDetailResponse> {
  return apiFetch<EmployeeDetailResponse>(`/employees/${id}`);
}
