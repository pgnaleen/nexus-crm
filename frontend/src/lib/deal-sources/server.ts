import type { DealSourceResponse } from "@orelia/common";
import { serverFetch } from "../api/server-client";

export function listDealSources(): Promise<DealSourceResponse[] | null> {
  return serverFetch<DealSourceResponse[]>("/deal-sources");
}
