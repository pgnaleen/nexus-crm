import type { DashboardPreferenceResponse, UpdateDashboardPreferenceRequest } from "@orelia/common";
import { apiFetch } from "./client";

export function updateDashboardPreferences(
  payload: UpdateDashboardPreferenceRequest,
): Promise<DashboardPreferenceResponse> {
  return apiFetch<DashboardPreferenceResponse>("/dashboard/preferences", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
