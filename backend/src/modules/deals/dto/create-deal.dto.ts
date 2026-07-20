import { CreateDealRequest, DealPriority, DealType } from "@orelia/common";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreateDealDto implements CreateDealRequest {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsEnum(DealType)
  dealType!: DealType;

  @IsOptional()
  @IsString()
  description?: string;

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

  @IsOptional()
  @IsUUID()
  referredByCompanyId?: string;

  @IsOptional()
  @IsUUID()
  referredByEmployeeId?: string;

  @IsUUID()
  ownerId!: string;

  @IsOptional()
  @IsUUID()
  mainStageId?: string;

  @IsUUID()
  currentStageId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedValue?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  probability?: number;

  @IsOptional()
  @IsEnum(DealPriority)
  priority?: DealPriority;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}