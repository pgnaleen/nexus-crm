import type { PriorityTaskResponse } from "@orelia/common";
import { serverFetch } from "../api/server-client";

export function listPriorityTasks(): Promise<PriorityTaskResponse[] | null> {
  return serverFetch<PriorityTaskResponse[]>("/priority-tasks");
}
