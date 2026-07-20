import {
  AccountTier,
  CreditStatus,
  EmployeeCountBand,
  FiscalYearEndMonth,
  Region,
  RevenueBand,
  Sector,
  UpdateCompanyRequest,
} from "@orelia/common";
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateRelationshipPartyCompanyDto implements UpdateCompanyRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  brands?: string[];

  @IsOptional()
  @IsUUID()
  industryId?: string;

  @IsOptional()
  @IsString()
  subIndustry?: string;

  // @IsOptional() lets null/undefined both through without hitting @IsEnum --
  // null is a real "clear the field" value, undefined means "field omitted,
  // leave untouched" (see update-deal-source.dto.ts for the same pattern).
  @IsOptional()
  @IsEnum(AccountTier)
  accountTier?: AccountTier | null;

  @IsOptional()
  @IsEnum(EmployeeCountBand)
  employeeCount?: EmployeeCountBand | null;

  @IsOptional()
  @IsEnum(RevenueBand)
  revenueBand?: RevenueBand | null;

  @IsOptional()
  @IsNumber()
  annualSpend?: number | null;

  @IsOptional()
  @IsEnum(Sector)
  sector?: Sector | null;

  @IsOptional()
  @IsString()
  stockTicker?: string;

  @IsOptional()
  @IsEnum(FiscalYearEndMonth)
  fiscalYearEnd?: FiscalYearEndMonth | null;

  @IsOptional()
  @IsEnum(Region)
  region?: Region | null;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  hqCityAddress?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branches?: string[];

  @IsOptional()
  @IsUUID()
  parentCompanyId?: string | null;

  @IsOptional()
  @IsString()
  parentCompanyName?: string;

  @IsOptional()
  @IsEnum(CreditStatus)
  credit?: CreditStatus | null;

  @IsOptional()
  @IsUUID()
  territoryOwnerId?: string | null;

  @IsOptional()
  @IsString()
  territoryNotes?: string;
}
