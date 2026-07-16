import { RoleBuying, UpdateContactRequest } from "@orelia/common";
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class UpdateRelationshipPartyContactDto implements UpdateContactRequest {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  department?: string;

  // null explicitly clears the role; undefined means "field omitted, leave
  // untouched" -- same pattern as update-deal-source.dto.ts.
  @IsOptional()
  @IsEnum(RoleBuying)
  roleBuying?: RoleBuying | null;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  mobileNo?: string;

  @IsOptional()
  @IsString()
  directPhoneNo?: string;

  @IsOptional()
  @IsString()
  linkedIn?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}
