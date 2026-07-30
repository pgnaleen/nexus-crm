import type {
  AcceptPriorityTaskRequest,
  CreatePriorityTaskMessageRequest,
  CreatePriorityTaskRequest,
  CreatePriorityTaskShareRequest,
  DelegatePriorityTaskRequest,
  IncomingTaskResponse,
  MovePriorityTaskRequest,
  PriorityTaskHistoryEntry,
  PriorityTaskDelegationTrackerResponse,
  PriorityTaskMessageResponse,
  PriorityTaskResponse,
  PriorityTaskShareResponse,
  UpdatePriorityTaskMessageRequest,
  UpdatePriorityTaskProgressRequest,
  UpdatePriorityTaskRequest,
} from "@orelia/common";
import { apiFetch } from "./client";

export function createPriorityTask(payload: CreatePriorityTaskRequest): Promise<PriorityTaskResponse> {
  return apiFetch<PriorityTaskResponse>("/priority-tasks", { method: "POST", body: JSON.stringify(payload) });
}

// Story 3.4 -- the initial page load fetches this server-side
// (lib/priority-tasks/server.ts::listPriorityTasks); this client-side twin
// is for the live-sync refresh a priority-task:flow-changed event triggers,
// which has no server-render context to run in.
export function listPriorityTasks(): Promise<PriorityTaskResponse[]> {
  return apiFetch<PriorityTaskResponse[]>("/priority-tasks");
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

// Story 1.10 -- archive / restore.
export function listArchivedPriorityTasks(): Promise<PriorityTaskResponse[]> {
  return apiFetch<PriorityTaskResponse[]>("/priority-tasks/archived");
}

export function archivePriorityTask(id: string): Promise<PriorityTaskResponse> {
  return apiFetch<PriorityTaskResponse>(`/priority-tasks/${id}/archive`, { method: "PATCH" });
}

export function restorePriorityTask(id: string): Promise<PriorityTaskResponse> {
  return apiFetch<PriorityTaskResponse>(`/priority-tasks/${id}/restore`, { method: "PATCH" });
}

// Story 2.10 -- clears an archived task out of the Archive for good. Soft
// delete server-side: the row persists with deletedAt/deletedBy set and an
// audit_logs entry, it just stops being returned anywhere.
export function deletePriorityTask(id: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/priority-tasks/${id}`, { method: "DELETE" });
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

// Story 3.3 -- task chat, additive to notes. Anyone with access to the task
// (owner, tracker-holder, share recipient, or pending delegate) can read and
// post -- broader than the owner-only rule shares/mutations elsewhere in
// this module use.
export function listPriorityTaskMessages(taskId: string): Promise<PriorityTaskMessageResponse[]> {
  return apiFetch<PriorityTaskMessageResponse[]>(`/priority-tasks/${taskId}/messages`);
}

export function createPriorityTaskMessage(
  taskId: string,
  payload: CreatePriorityTaskMessageRequest,
): Promise<PriorityTaskMessageResponse> {
  return apiFetch<PriorityTaskMessageResponse>(`/priority-tasks/${taskId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePriorityTaskMessage(
  taskId: string,
  messageId: string,
  payload: UpdatePriorityTaskMessageRequest,
): Promise<PriorityTaskMessageResponse> {
  return apiFetch<PriorityTaskMessageResponse>(`/priority-tasks/${taskId}/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deletePriorityTaskMessage(taskId: string, messageId: string): Promise<PriorityTaskMessageResponse> {
  return apiFetch<PriorityTaskMessageResponse>(`/priority-tasks/${taskId}/messages/${messageId}`, {
    method: "DELETE",
  });
}
