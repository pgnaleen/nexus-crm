import type {
  AssignDealRoleRequest,
  CreateDealDocumentRequest,
  CreateDealNoteRequest,
  CreateDealRequest,
  CreateDealRoleRequest,
  DealDependentsCountResponse,
  DealDocumentResponse,
  DealNoteResponse,
  DealPartnerResponse,
  DealResponse,
  DealRoleAssignmentResponse,
  DealRoleResponse,
  DealStageHistoryResponse,
  DealTenderDetailsResponse,
  MoveDealStageRequest,
  UpdateDealNoteRequest,
  UpdateDealRequest,
  UpsertDealTenderDetailsRequest,
} from "@orelia/common";
import { ApiError, apiFetch, redirectToLogin, refreshSession } from "./client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function listDeals(mainStageId?: string): Promise<DealResponse[]> {
  const query = mainStageId ? `?mainStageId=${encodeURIComponent(mainStageId)}` : "";
  return apiFetch<DealResponse[]>(`/deals${query}`);
}

export function getDeal(id: string): Promise<DealResponse> {
  return apiFetch<DealResponse>(`/deals/${id}`);
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

export function getDealDependentsCount(id: string): Promise<DealDependentsCountResponse> {
  return apiFetch<DealDependentsCountResponse>(`/deals/${id}/dependents-count`);
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
  if (meta.version) formData.append("version", meta.version);

  // Raw fetch, not apiFetch -- apiFetch forces a JSON Content-Type header,
  // which would break this multipart/form-data upload (the browser needs to
  // set its own boundary-bearing Content-Type from the FormData body).
  // Still shares apiFetch's 401-refresh-retry path though, so an expired
  // token mid-dialog doesn't fail the upload outright.
  const doFetch = () =>
    fetch(`${API_BASE_URL}/api/deals/${dealId}/documents`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

  let res = await doFetch();

  if (res.status === 401) {
    if (await refreshSession()) {
      res = await doFetch();
    } else {
      redirectToLogin();
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? "Failed to upload document", res.status);
  }

  return res.json() as Promise<DealDocumentResponse>;
}

export function deleteDealDocument(dealId: string, documentId: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/deals/${dealId}/documents/${documentId}`, { method: "DELETE" });
}

export function listDealPartners(dealId: string): Promise<DealPartnerResponse[]> {
  return apiFetch<DealPartnerResponse[]>(`/deals/${dealId}/partners`);
}

export function addDealPartnerCompany(dealId: string, companyId: string): Promise<DealPartnerResponse> {
  return apiFetch<DealPartnerResponse>(`/deals/${dealId}/partners/companies`, {
    method: "POST",
    body: JSON.stringify({ companyId }),
  });
}

export function addDealPartnerContact(dealId: string, contactId: string): Promise<DealPartnerResponse> {
  return apiFetch<DealPartnerResponse>(`/deals/${dealId}/partners/contacts`, {
    method: "POST",
    body: JSON.stringify({ contactId }),
  });
}

export function removeDealPartner(dealId: string, partnerId: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/deals/${dealId}/partners/${partnerId}`, { method: "DELETE" });
}

export function listDealRoles(): Promise<DealRoleResponse[]> {
  return apiFetch<DealRoleResponse[]>("/deal-roles");
}

export function createDealRole(payload: CreateDealRoleRequest): Promise<DealRoleResponse> {
  return apiFetch<DealRoleResponse>("/deal-roles", { method: "POST", body: JSON.stringify(payload) });
}

export function listDealTeam(dealId: string): Promise<DealRoleAssignmentResponse[]> {
  return apiFetch<DealRoleAssignmentResponse[]>(`/deals/${dealId}/team`);
}

export function assignDealRole(dealId: string, payload: AssignDealRoleRequest): Promise<DealRoleAssignmentResponse> {
  return apiFetch<DealRoleAssignmentResponse>(`/deals/${dealId}/team`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function removeDealRoleAssignment(dealId: string, assignmentId: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/deals/${dealId}/team/${assignmentId}`, { method: "DELETE" });
}

export function setPrimaryDealRoleAssignment(
  dealId: string,
  assignmentId: string,
): Promise<DealRoleAssignmentResponse> {
  return apiFetch<DealRoleAssignmentResponse>(`/deals/${dealId}/team/${assignmentId}/primary`, { method: "PATCH" });
}

export function listDealNotes(dealId: string): Promise<DealNoteResponse[]> {
  return apiFetch<DealNoteResponse[]>(`/deals/${dealId}/notes`);
}

export function createDealNote(dealId: string, payload: CreateDealNoteRequest): Promise<DealNoteResponse> {
  return apiFetch<DealNoteResponse>(`/deals/${dealId}/notes`, { method: "POST", body: JSON.stringify(payload) });
}

export function updateDealNote(
  dealId: string,
  noteId: string,
  payload: UpdateDealNoteRequest,
): Promise<DealNoteResponse> {
  return apiFetch<DealNoteResponse>(`/deals/${dealId}/notes/${noteId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteDealNote(dealId: string, noteId: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/deals/${dealId}/notes/${noteId}`, { method: "DELETE" });
}

export function getDealTenderDetails(dealId: string): Promise<DealTenderDetailsResponse | null> {
  return apiFetch<DealTenderDetailsResponse | null>(`/deals/${dealId}/tender-details`);
}

export function upsertDealTenderDetails(
  dealId: string,
  payload: UpsertDealTenderDetailsRequest,
): Promise<DealTenderDetailsResponse> {
  return apiFetch<DealTenderDetailsResponse>(`/deals/${dealId}/tender-details`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
