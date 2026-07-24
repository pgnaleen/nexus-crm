import type { CertificationResponse, CertificationReviewResponse } from "@orelia/common";
import { serverFetch } from "../api/server-client";

// Story 1.12 -- the caller's own certifications for My Profile's initial
// render (client-side mutations take over from there).
export function fetchMyCertifications(): Promise<CertificationResponse[] | null> {
  return serverFetch<CertificationResponse[]>("/certifications/me");
}

// Story 1.13 -- every pending claim in the tenant for the HR review queue
// (EMPLOYEES_VERIFY_CERTIFICATIONS).
export function fetchPendingCertifications(): Promise<CertificationReviewResponse[] | null> {
  return serverFetch<CertificationReviewResponse[]>("/certifications/review");
}
