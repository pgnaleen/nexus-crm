import { CreateTenantRequest, TenantStatus } from "@orelia/common";
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateTenantDto implements CreateTenantRequest {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, {
    message: "slug must be lowercase alphanumeric with optional hyphens",
  })
  @MinLength(2)
  @MaxLength(60)
  slug!: string;

  @IsUUID()
  planId!: string;

  @IsOptional()
  @IsUUID()
  industryId?: string;

  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  tagline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phoneNo?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsEmail()
  billingEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string;
}
