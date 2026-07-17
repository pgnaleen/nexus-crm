import type { DealStageResponse } from "@orelia/common";
import { serverFetch } from "../api/server-client";

export function listSubStages(): Promise<DealStageResponse[] | null> {
  return serverFetch<DealStageResponse[]>("/sub-stages");
}
