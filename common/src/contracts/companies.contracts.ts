import { AccountTier, EmployeeCountBand, RevenueBand } from "../enums";
import { ICompany } from "../types";

export interface CreateCompanyRequest {
  name: string;
  url?: string;
  logo?: string;
  industryId?: string;
  subIndustry?: string;
  accountTier?: AccountTier;
  employeeCount?: EmployeeCountBand;
  revenueBand?: RevenueBand;
  annualSpend?: number;
  country?: string;
  hqCityAddress?: string;
  parentCompanyId?: string;
}

export interface UpdateCompanyRequest {
  name?: string;
  url?: string;
  logo?: string;
  industryId?: string;
  subIndustry?: string;
  // null explicitly clears these; undefined/omitted leaves them untouched.
  accountTier?: AccountTier | null;
  employeeCount?: EmployeeCountBand | null;
  revenueBand?: RevenueBand | null;
  annualSpend?: number | null;
  country?: string;
  hqCityAddress?: string;
  parentCompanyId?: string;
}

export type CompanyResponse = ICompany;
