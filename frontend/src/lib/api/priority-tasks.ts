import type {
  AcceptPriorityTaskRequest,
  CreatePriorityTaskRequest,
  CreatePriorityTaskShareRequest,
  DelegatePriorityTaskRequest,
  IncomingTaskResponse,
  MovePriorityTaskRequest,
  PriorityTaskHistoryEntry,
  PriorityTaskDelegationTrackerResponse,
  PriorityTaskResponse,
  PriorityTaskShareResponse,
  UpdatePriorityTaskProgressRequest,
  UpdatePriorityTaskRequest,
} from "@orelia/common";
import { apiFetch } from "./client";

export function createPriorityTask(payload: CreatePriorityTaskRequest): Promise<PriorityTaskResponse> {
  return apiFetch<PriorityTaskResponse>("/priority-tasks", { method: "POST", body: JSON.stringify(payload) });
}

export function getPriorityTask(id: string): Promise<PriorityTaskResponse> {
  return apiFetch<PriorityTaskResponse>(`/priority-tasks/${id}`);
}

export function updatePriorityTask(id: string, payload: UpdatePriorityTaskRequest): Promise<PriorityTaskResponse> {
  return apiFetch<PriorityTaskResponse>(`/priority-tasks/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function updatePriorityTaskProgress(
  id: string,
  payload: UpdatePriorityTaskProgressRequest,
): Promise<PriorityTaskResponse> {
  return apiFetch<PriorityTaskResponse>(`/priority-tasks/${id}/progress`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getPriorityTaskHistory(id: string): Promise<PriorityTaskHistoryEntry[]> {
  return apiFetch<PriorityTaskHistoryEntry[]>(`/priority-tasks/${id}/history`);
}

export function completePriorityTask(id: string): Promise<PriorityTaskResponse> {
  return apiFetch<PriorityTaskResponse>(`/priority-tasks/${id}/complete`, { method: "PATCH" });
}

export function movePriorityTask(id: string, payload: MovePriorityTaskRequest): Promise<PriorityTaskResponse> {
  return apiFetch<PriorityTaskResponse>(`/priority-tasks/${id}/move`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function listPriorityTaskShares(taskId: string): Promise<PriorityTaskShareResponse[]> {
  return apiFetch<PriorityTaskShareResponse[]>(`/priority-tasks/${taskId}/shares`);
}

export function createPriorityTaskShare(
  taskId: string,
  payload: CreatePriorityTaskShareRequest,
): Promise<PriorityTaskShareResponse> {
  return apiFetch<PriorityTaskShareResponse>(`/priority-tasks/${taskId}/shares`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function removePriorityTaskShare(taskId: string, shareId: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/priority-tasks/${taskId}/shares/${shareId}`, { method: "DELETE" });
}

export function delegatePriorityTask(id: string, payload: DelegatePriorityTaskRequest): Promise<PriorityTaskResponse> {
  return apiFetch<PriorityTaskResponse>(`/priority-tasks/${id}/delegate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listPriorityTaskDelegationTrackers(): Promise<PriorityTaskDelegationTrackerResponse[]> {
  return apiFetch<PriorityTaskDelegationTrackerResponse[]>("/priority-tasks/delegated-trackers");
}

// Story 1.8 -- Incoming panel: everything shared with or delegated to me.
export function listIncomingPriorityTasks(): Promise<IncomingTaskResponse[]> {
  return apiFetch<IncomingTaskResponse[]>("/priority-tasks/incoming");
}

export function acceptPriorityTask(id: string, payload: AcceptPriorityTaskRequest): Promise<PriorityTaskResponse> {
  return apiFetch<PriorityTaskResponse>(`/priority-tasks/${id}/accept`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function redelegatePriorityTask(id: string, payload: DelegatePriorityTaskRequest): Promise<PriorityTaskResponse> {
  return apiFetch<PriorityTaskResponse>(`/priority-tasks/${id}/redelegate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
