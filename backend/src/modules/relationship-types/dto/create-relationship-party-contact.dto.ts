import { CreateContactRequest, RoleBuying } from "@orelia/common";
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateRelationshipPartyContactDto implements CreateContactRequest {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsEnum(RoleBuying)
  roleBuying?: RoleBuying;

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
