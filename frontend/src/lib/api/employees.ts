import type {
  CreateEmployeeRequest,
  EmployeeDetailResponse,
  EmployeeLinkPickerResponse,
  EmployeeListItemResponse,
  OrgChartEmployeeResponse,
  UpdateEmployeeRequest,
  UpdateMyPhotoRequest,
  UpdateOrgChartStructureRequest,
} from "@orelia/common";
import { apiFetch } from "./client";

// Self-service profile photo. No id: the backend resolves the caller's own
// employee record from their token. Pass null to clear the photo.
export function updateMyPhoto(profilePhotoUrl: string | null): Promise<EmployeeDetailResponse> {
  const payload: UpdateMyPhotoRequest = { profilePhotoUrl };
  return apiFetch<EmployeeDetailResponse>("/employees/me/photo", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

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

export function deleteEmployee(id: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/employees/${id}`, { method: "DELETE" });
}

// Story 1.8 -- fresh chart data after a structure save (same endpoint the
// page's server fetch uses).
export function getOrgChart(): Promise<OrgChartEmployeeResponse[]> {
  return apiFetch<OrgChartEmployeeResponse[]>("/employees/org-chart");
}

// Story 1.8 -- the chart editor's batch commit: every changed reporting
// relationship in one request.
export function updateOrgChartStructure(payload: UpdateOrgChartStructureRequest): Promise<{ success: true }> {
  return apiFetch<{ success: true }>("/employees/org-chart/structure", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// Story 1.6 -- User Management's "link to Employee" picker options (picker
// route, gated on USERS_CREATE/USERS_UPDATE, not employee admin permissions).
export function listLinkableEmployees(forUserId?: string): Promise<EmployeeLinkPickerResponse[]> {
  const query = forUserId ? `?forUserId=${encodeURIComponent(forUserId)}` : "";
  return apiFetch<EmployeeLinkPickerResponse[]>(`/pickers/employees/linkable${query}`);
}
