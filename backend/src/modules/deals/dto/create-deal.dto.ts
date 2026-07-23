import { CreateDealRequest, DealType } from "@orelia/common";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
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

  @IsOptional()
  @IsUUID()
  mainStageId?: string;

  @IsUUID()
  currentStageId!: string;

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
