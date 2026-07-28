import { CreateDealRequest, DealType } from "@orelia/common";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  Length,
  Matches,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { CompetitorEntryDto } from "./competitor-entry.dto";

export class CreateDealDto implements CreateDealRequest {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsEnum(DealType)
  dealType!: DealType;

  // ISO 4217 code -- shape-checked here (3 uppercase letters), not validated
  // against the full ~180-entry list server-side. The frontend's
  // Intl.supportedValuesOf("currency") is the source of truth for which
  // codes are offered; duplicating that list here would just be a second
  // copy to keep in sync for no real safety benefit.
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/)
  currency!: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  primaryContactId?: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @IsUUID()
  ownerId!: string;

  @IsOptional()
  @IsUUID()
  preSalesPersonId?: string;

  @IsOptional()
  @IsUUID()
  pmoId?: string;

  @IsUUID()
  mainStageId!: string;

  @IsOptional()
  @IsUUID()
  currentStageId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  dealCountry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  customerPainPoint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  product?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  services?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  internalCosts?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  externalCosts?: number;

  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompetitorEntryDto)
  competitors?: CompetitorEntryDto[];

  @IsOptional()
  @IsBoolean()
  isTender?: boolean;
}
