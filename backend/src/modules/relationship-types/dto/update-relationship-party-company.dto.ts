import { AccountTier, EmployeeCountBand, RevenueBand, UpdateCompanyRequest } from "@orelia/common";
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

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
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  hqCityAddress?: string;

  @IsOptional()
  @IsUUID()
  parentCompanyId?: string;
}
