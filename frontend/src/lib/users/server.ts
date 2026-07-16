import type { UserSummaryResponse } from "@orelia/common";
import { serverFetch } from "../api/server-client";

export function listUsers(): Promise<UserSummaryResponse[] | null> {
  return serverFetch<UserSummaryResponse[]>("/users");
}
