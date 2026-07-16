import type { TeamResponse } from "@orelia/common";
import { serverFetch } from "../api/server-client";

export function listTeams(): Promise<TeamResponse[] | null> {
  return serverFetch<TeamResponse[]>("/teams");
}
