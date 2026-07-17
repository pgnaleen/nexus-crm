import type {
  CreateDepartmentRequest,
  DepartmentResponse,
  UpdateDepartmentRequest,
} from "@orelia/common";
import { apiFetch } from "./client";

export function listDepartments(): Promise<DepartmentResponse[]> {
  return apiFetch<DepartmentResponse[]>("/departments");
}

export function createDepartment(payload: CreateDepartmentRequest): Promise<DepartmentResponse> {
  return apiFetch<DepartmentResponse>("/departments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateDepartment(
  id: string,
  payload: UpdateDepartmentRequest,
): Promise<DepartmentResponse> {
  return apiFetch<DepartmentResponse>(`/departments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteDepartment(id: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/departments/${id}`, { method: "DELETE" });
}
