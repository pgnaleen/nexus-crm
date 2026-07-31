import {
  AccountTier,
  CreditStatus,
  EmployeeCountBand,
  FiscalYearEndMonth,
  Region,
  RevenueBand,
  Sector,
} from "../enums";

export interface ICompany {
  id: string;
  tenantId: string;
  name: string;
  url?: string | null;
  logo?: string | null;
  brands?: string[] | null;
  // A company can span several industries. industryIds are the stored
  // `company_industries` links; industryNames is the resolved display copy,
  // same pattern as territoryOwnerName below -- so a list/table can render
  // without a second lookup.
  industryIds?: string[] | null;
  industryNames?: string[] | null;
  subIndustry?: string | null;
  accountTier?: AccountTier | null;
  employeeCount?: EmployeeCountBand | null;
  revenueBand?: RevenueBand | null;
  annualSpend?: number | null;
  sector?: Sector | null;
  stockTicker?: string | null;
  fiscalYearEnd?: FiscalYearEndMonth | null;
  region?: Region | null;
  // A company can operate in several countries. Plain ISO names, matching the
  // frontend COUNTRIES list -- stored as a jsonb array, same as brands/branches.
  countries?: string[] | null;
  hqCityAddress?: string | null;
  branches?: string[] | null;
  parentCompanyId?: string | null;
  parentCompanyName?: string | null;
  credit?: CreditStatus | null;
  territoryOwnerId?: string | null;
  territoryOwnerName?: string | null;
  territoryNotes?: string | null;
}
