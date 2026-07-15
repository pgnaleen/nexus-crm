import { TenantStatus } from "../enums";

export interface IPlan {
  id: string;
  name: string;
  amount: number;
}

export interface IIndustry {
  id: string;
  name: string;
}

export interface ITenant {
  id: string;
  name: string;
  slug: string;
  tagline?: string | null;
  planId: string;
  status: TenantStatus;
  industryId?: string | null;
  phoneNo?: string | null;
  contactEmail?: string | null;
  billingEmail?: string | null;
  address?: string | null;
  trialEnds?: string | null;
  notes?: string | null;
}
