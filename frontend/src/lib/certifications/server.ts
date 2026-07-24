import type { CertificationResponse } from "@orelia/common";
import { serverFetch } from "../api/server-client";

// Story 1.12 -- the caller's own certifications for My Profile's initial
// render (client-side mutations take over from there).
export function fetchMyCertifications(): Promise<CertificationResponse[] | null> {
  return serverFetch<CertificationResponse[]>("/certifications/me");
}
