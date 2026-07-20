import type {
  AddDealContactRequest,
  CreateDealDocumentRequest,
  CreateDealRequest,
  DealContactResponse,
  DealDocumentResponse,
  DealResponse,
  DealStageHistoryResponse,
  MoveDealStageRequest,
  UpdateDealRequest,
} from "@orelia/common";
import { ApiError, apiFetch } from "./client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function listDeals(mainStageId?: string): Promise<DealResponse[]> {
  const query = mainStageId ? `?mainStageId=${encodeURIComponent(mainStageId)}` : "";
  return apiFetch<DealResponse[]>(`/deals${query}`);
}

export function createDeal(payload: CreateDealRequest): Promise<DealResponse> {
  return apiFetch<DealResponse>("/deals", { method: "POST", body: JSON.stringify(payload) });
}

export function updateDeal(id: string, payload: UpdateDealRequest): Promise<DealResponse> {
  return apiFetch<DealResponse>(`/deals/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deleteDeal(id: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/deals/${id}`, { method: "DELETE" });
}

export function moveDeal(id: string, payload: MoveDealStageRequest): Promise<DealResponse> {
  return apiFetch<DealResponse>(`/deals/${id}/move`, { method: "POST", body: JSON.stringify(payload) });
}

export function listDealStageHistory(id: string): Promise<DealStageHistoryResponse[]> {
  return apiFetch<DealStageHistoryResponse[]>(`/deals/${id}/stage-history`);
}

export function listDealDocuments(dealId: string): Promise<DealDocumentResponse[]> {
  return apiFetch<DealDocumentResponse[]>(`/deals/${dealId}/documents`);
}

// Not routed through apiFetch -- that helper always sets
// Content-Type: application/json, which would break the multipart boundary
// the browser needs to set itself for a FormData body.
export async function uploadDealDocument(
  dealId: string,
  file: File,
  meta: CreateDealDocumentRequest,
): Promise<DealDocumentResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("docType", meta.docType);
  formData.append("title", meta.title);

  const res = await fetch(`${API_BASE_URL}/api/deals/${dealId}/documents`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? "Failed to upload document", res.status);
  }

  return res.json() as Promise<DealDocumentResponse>;
}

export function deleteDealDocument(dealId: string, documentId: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/deals/${dealId}/documents/${documentId}`, { method: "DELETE" });
}

export function listDealContacts(dealId: string): Promise<DealContactResponse[]> {
  return apiFetch<DealContactResponse[]>(`/deals/${dealId}/contacts`);
}

export function addDealContact(
  dealId: string,
  payload: AddDealContactRequest,
): Promise<DealContactResponse> {
  return apiFetch<DealContactResponse>(`/deals/${dealId}/contacts`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function removeDealContact(dealId: string, contactId: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/deals/${dealId}/contacts/${contactId}`, { method: "DELETE" });
}
