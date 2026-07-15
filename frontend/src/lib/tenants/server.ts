import type { IndustryResponse, PlanResponse, PublicTenantResponse, TenantResponse } from "@orelia/common";
import { serverFetch } from "../api/server-client";

export function getPublicTenant(slug: string): Promise<PublicTenantResponse | null> {
  return serverFetch<PublicTenantResponse>(`/tenants/by-slug/${encodeURIComponent(slug)}`);
}

export function listTenants(): Promise<TenantResponse[] | null> {
  return serverFetch<TenantResponse[]>("/tenants");
}

export function listPlans(): Promise<PlanResponse[] | null> {
  return serverFetch<PlanResponse[]>("/tenants/plans");
}

export function listIndustries(): Promise<IndustryResponse[] | null> {
  return serverFetch<IndustryResponse[]>("/tenants/industries");
}
