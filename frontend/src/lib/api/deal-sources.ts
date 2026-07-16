import type {
  CreateDealSourceRequest,
  DealSourceResponse,
  UpdateDealSourceRequest,
} from "@orelia/common";
import { apiFetch } from "./client";

export function listDealSources(): Promise<DealSourceResponse[]> {
  return apiFetch<DealSourceResponse[]>("/deal-sources");
}

export function createDealSource(payload: CreateDealSourceRequest): Promise<DealSourceResponse> {
  return apiFetch<DealSourceResponse>("/deal-sources", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateDealSource(
  id: string,
  payload: UpdateDealSourceRequest,
): Promise<DealSourceResponse> {
  return apiFetch<DealSourceResponse>(`/deal-sources/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteDealSource(id: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/deal-sources/${id}`, { method: "DELETE" });
}
