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

export type UpdateCompanyRequest = Partial<CreateCompanyRequest>;

export type CompanyResponse = ICompany;
