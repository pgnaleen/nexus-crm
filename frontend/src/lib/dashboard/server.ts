import type { DashboardPreferenceResponse } from "@orelia/common";
import { serverFetch } from "../api/server-client";

export function fetchDashboardPreferences(): Promise<DashboardPreferenceResponse | null> {
  return serverFetch<DashboardPreferenceResponse | null>("/dashboard/preferences");
}
