import { AccountTier, CreateCompanyRequest, EmployeeCountBand, RevenueBand } from "@orelia/common";
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateRelationshipPartyCompanyDto implements CreateCompanyRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

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

  @IsOptional()
  @IsEnum(AccountTier)
  accountTier?: AccountTier;

  @IsOptional()
  @IsEnum(EmployeeCountBand)
  employeeCount?: EmployeeCountBand;

  @IsOptional()
  @IsEnum(RevenueBand)
  revenueBand?: RevenueBand;

  @IsOptional()
  @IsNumber()
  annualSpend?: number;

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
