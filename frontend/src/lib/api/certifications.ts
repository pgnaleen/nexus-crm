import type {
  CertificationResponse,
  CreateCertificationRequest,
  UpdateCertificationRequest,
} from "@orelia/common";
import { apiFetch } from "./client";

// Story 1.12 -- self-service certifications on My Profile. All routes are
// auth-only (the backend resolves the caller's own employee); no permission
// needed beyond being logged in and linked to an employee record.

export function listMyCertifications(): Promise<CertificationResponse[]> {
  return apiFetch<CertificationResponse[]>("/certifications/me");
}

export function createMyCertification(payload: CreateCertificationRequest): Promise<CertificationResponse> {
  return apiFetch<CertificationResponse>("/certifications/me", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateMyCertification(
  id: string,
  payload: UpdateCertificationRequest,
): Promise<CertificationResponse> {
  return apiFetch<CertificationResponse>(`/certifications/me/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteMyCertification(id: string): Promise<void> {
  return apiFetch<void>(`/certifications/me/${id}`, { method: "DELETE" });
}
