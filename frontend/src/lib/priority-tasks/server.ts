import type { PriorityTaskDelegationTrackerResponse, PriorityTaskResponse } from "@orelia/common";
import { serverFetch } from "../api/server-client";

export function listPriorityTasks(): Promise<PriorityTaskResponse[] | null> {
  return serverFetch<PriorityTaskResponse[]>("/priority-tasks");
}

export function listPriorityTaskDelegationTrackers(): Promise<PriorityTaskDelegationTrackerResponse[] | null> {
  return serverFetch<PriorityTaskDelegationTrackerResponse[]>("/priority-tasks/delegated-trackers");
}
