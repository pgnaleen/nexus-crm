import type {
  CreateDealStageRequest,
  DealStageResponse,
  UpdateDealStageRequest,
} from "@orelia/common";
import { apiFetch } from "./client";

export function listSubStages(): Promise<DealStageResponse[]> {
  return apiFetch<DealStageResponse[]>("/sub-stages");
}

export function createSubStage(payload: CreateDealStageRequest): Promise<DealStageResponse> {
  return apiFetch<DealStageResponse>("/sub-stages", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateSubStage(
  id: string,
  payload: UpdateDealStageRequest,
): Promise<DealStageResponse> {
  return apiFetch<DealStageResponse>(`/sub-stages/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteSubStage(id: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/sub-stages/${id}`, { method: "DELETE" });
}
