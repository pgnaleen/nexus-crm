import { AccountTier, CreditStatus, EmployeeCountBand, FiscalYearEndMonth, Region, RevenueBand, Sector } from "../enums";
import { ICompany } from "../types";

export interface CreateCompanyRequest {
  name: string;
  url?: string;
  logo?: string;
  brands?: string[];
  industryIds?: string[];
  subIndustry?: string;
  accountTier?: AccountTier;
  employeeCount?: EmployeeCountBand;
  revenueBand?: RevenueBand;
  annualSpend?: number;
  sector?: Sector;
  stockTicker?: string;
  fiscalYearEnd?: FiscalYearEndMonth;
  region?: Region;
  countries?: string[];
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
  // An empty array clears every industry link; omitted leaves them untouched.
  industryIds?: string[];
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
  // An empty array clears every country; omitted leaves them untouched.
  countries?: string[];
  hqCityAddress?: string;
  branches?: string[];
  parentCompanyId?: string | null;
  parentCompanyName?: string | null;
  credit?: CreditStatus | null;
  territoryOwnerId?: string | null;
  territoryNotes?: string;
}

// logo (from ICompany) is the stable stored S3 key, submitted back verbatim
// on save if untouched. logoDisplayUrl is a fresh, short-lived signed URL
// generated at response-build time purely for rendering -- never persisted.
export interface CompanyResponse extends ICompany {
  logoDisplayUrl: string | null;
}
