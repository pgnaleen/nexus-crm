import type { CreateTenantRequest, TenantResponse, UpdateTenantRequest } from "@orelia/common";
import { apiFetch } from "./client";

export function createTenant(payload: CreateTenantRequest): Promise<TenantResponse> {
  return apiFetch<TenantResponse>("/tenants", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateTenant(id: string, payload: UpdateTenantRequest): Promise<TenantResponse> {
  return apiFetch<TenantResponse>(`/tenants/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteTenant(id: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/tenants/${id}`, { method: "DELETE" });
}
