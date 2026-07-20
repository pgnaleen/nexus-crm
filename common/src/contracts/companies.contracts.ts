import { AccountTier, CreditStatus, EmployeeCountBand, FiscalYearEndMonth, Region, RevenueBand, Sector } from "../enums";
import { ICompany } from "../types";

export interface CreateCompanyRequest {
  name: string;
  url?: string;
  logo?: string;
  brands?: string[];
  industryId?: string;
  subIndustry?: string;
  accountTier?: AccountTier;
  employeeCount?: EmployeeCountBand;
  revenueBand?: RevenueBand;
  annualSpend?: number;
  sector?: Sector;
  stockTicker?: string;
  fiscalYearEnd?: FiscalYearEndMonth;
  region?: Region;
  country?: string;
  hqCityAddress?: string;
  branches?: string[];
  parentCompanyId?: string;
  parentCompanyName?: string;
  credit?: CreditStatus;
  territoryOwnerId?: string;
  territoryNotes?: string;
}

export interface UpdateCompanyRequest {
  name?: string;
  url?: string;
  logo?: string;
  brands?: string[];
  industryId?: string;
  subIndustry?: string;
  // null explicitly clears these; undefined/omitted leaves them untouched.
  accountTier?: AccountTier | null;
  employeeCount?: EmployeeCountBand | null;
  revenueBand?: RevenueBand | null;
  annualSpend?: number | null;
  sector?: Sector | null;
  stockTicker?: string;
  fiscalYearEnd?: FiscalYearEndMonth | null;
  region?: Region | null;
  country?: string;
  hqCityAddress?: string;
  branches?: string[];
  parentCompanyId?: string | null;
  parentCompanyName?: string;
  credit?: CreditStatus | null;
  territoryOwnerId?: string | null;
  territoryNotes?: string;
}

export type CompanyResponse = ICompany;
