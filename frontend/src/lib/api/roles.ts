import type {
  AssignRoleResourcesRequest,
  CreateRoleRequest,
  RbacResourceResponse,
  RbacRoleResponse,
  UpdateRoleRequest,
} from "@orelia/common";
import { apiFetch } from "./client";

export function createRole(payload: CreateRoleRequest): Promise<RbacRoleResponse> {
  return apiFetch<RbacRoleResponse>("/rbac/roles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateRole(id: string, payload: UpdateRoleRequest): Promise<RbacRoleResponse> {
  return apiFetch<RbacRoleResponse>(`/rbac/roles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteRole(id: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/rbac/roles/${id}`, { method: "DELETE" });
}

export function getRoleResourceIds(id: string): Promise<string[]> {
  return apiFetch<string[]>(`/rbac/roles/${id}/resources`);
}

export function assignRoleResources(
  id: string,
  payload: AssignRoleResourcesRequest,
): Promise<RbacRoleResponse> {
  return apiFetch<RbacRoleResponse>(`/rbac/roles/${id}/resources`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export type { RbacResourceResponse, RbacRoleResponse };
