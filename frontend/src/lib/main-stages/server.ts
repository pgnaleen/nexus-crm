import type { MainStageResponse } from "@orelia/common";
import { serverFetch } from "../api/server-client";

export function listMainStages(): Promise<MainStageResponse[] | null> {
  return serverFetch<MainStageResponse[]>("/main-stages");
}
