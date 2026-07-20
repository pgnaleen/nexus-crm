import type { DealResponse } from "@orelia/common";
import { serverFetch } from "../api/server-client";

export function listDeals(mainStageId?: string): Promise<DealResponse[] | null> {
  const query = mainStageId ? `?mainStageId=${encodeURIComponent(mainStageId)}` : "";
  return serverFetch<DealResponse[]>(`/deals${query}`);
}