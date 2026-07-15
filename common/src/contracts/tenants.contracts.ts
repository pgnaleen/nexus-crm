import { TenantStatus } from "../enums";

/** Minimal public tenant info for pre-login greetings — no billing/contact fields. */
export interface PublicTenantResponse {
  name: string;
  slug: string;
}

export interface TenantResponse {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  planId: string;
  planName: string;
  industryId: string | null;
  industryName: string | null;
  tagline: string | null;
  phoneNo: string | null;
  contactEmail: string | null;
  billingEmail: string | null;
  address: string | null;
}

export interface PlanResponse {
  id: string;
  name: string;
  amount: number;
}

export interface IndustryResponse {
  id: string;
  name: string;
}

export interface CreateTenantRequest {
  name: string;
  slug: string;
  planId: string;
  industryId?: string;
  status?: TenantStatus;
  tagline?: string;
  phoneNo?: string;
  contactEmail?: string;
  billingEmail?: string;
  address?: string;
}

export type UpdateTenantRequest = Partial<CreateTenantRequest>;
