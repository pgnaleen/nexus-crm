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
  industryId?: string | null;
  subIndustry?: string | null;
  accountTier?: AccountTier | null;
  employeeCount?: EmployeeCountBand | null;
  revenueBand?: RevenueBand | null;
  annualSpend?: number | null;
  sector?: Sector | null;
  stockTicker?: string | null;
  fiscalYearEnd?: FiscalYearEndMonth | null;
  region?: Region | null;
  country?: string | null;
  hqCityAddress?: string | null;
  branches?: string[] | null;
  parentCompanyId?: string | null;
  credit?: CreditStatus | null;
  territoryOwnerId?: string | null;
  territoryNotes?: string | null;
}
