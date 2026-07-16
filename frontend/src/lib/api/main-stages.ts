import type {
  CreateMainStageRequest,
  MainStageResponse,
  UpdateMainStageRequest,
} from "@orelia/common";
import { apiFetch } from "./client";

export function listMainStages(): Promise<MainStageResponse[]> {
  return apiFetch<MainStageResponse[]>("/main-stages");
}

export function createMainStage(payload: CreateMainStageRequest): Promise<MainStageResponse> {
  return apiFetch<MainStageResponse>("/main-stages", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateMainStage(
  id: string,
  payload: UpdateMainStageRequest,
): Promise<MainStageResponse> {
  return apiFetch<MainStageResponse>(`/main-stages/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteMainStage(id: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/main-stages/${id}`, { method: "DELETE" });
}
