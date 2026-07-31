import {
  AccountTier,
  CreateRelationshipPartyCompanyRequest,
  CreditStatus,
  EmployeeCountBand,
  FiscalYearEndMonth,
  Region,
  RevenueBand,
  Sector,
} from "@orelia/common";
import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { CreateRelationshipPartyContactDto } from "./create-relationship-party-contact.dto";

export class CreateRelationshipPartyCompanyDto implements CreateRelationshipPartyCompanyRequest {
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
  @IsArray()
  @IsString({ each: true })
  brands?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  industryIds?: string[];

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
  @IsEnum(Sector)
  sector?: Sector;

  @IsOptional()
  @IsString()
  stockTicker?: string;

  @IsOptional()
  @IsEnum(FiscalYearEndMonth)
  fiscalYearEnd?: FiscalYearEndMonth;

  @IsOptional()
  @IsEnum(Region)
  region?: Region;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[];

  @IsOptional()
  @IsString()
  hqCityAddress?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branches?: string[];

  @IsOptional()
  @IsUUID()
  parentCompanyId?: string;

  @IsOptional()
  @IsString()
  parentCompanyName?: string;

  @IsOptional()
  @IsEnum(CreditStatus)
  credit?: CreditStatus;

  @IsOptional()
  @IsUUID()
  territoryOwnerId?: string;

  @IsOptional()
  @IsString()
  territoryNotes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRelationshipPartyContactDto)
  contacts?: CreateRelationshipPartyContactDto[];
}
