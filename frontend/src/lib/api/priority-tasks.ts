import type {
  CreatePriorityTaskRequest,
  MovePriorityTaskRequest,
  PriorityTaskResponse,
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

export function movePriorityTask(id: string, payload: MovePriorityTaskRequest): Promise<PriorityTaskResponse> {
  return apiFetch<PriorityTaskResponse>(`/priority-tasks/${id}/move`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
