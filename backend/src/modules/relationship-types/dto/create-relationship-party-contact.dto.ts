import { CreateContactRequest, RoleBuying } from "@orelia/common";
import { IsEmail, IsEnum, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from "class-validator";
import { IsValidPhoneNumber } from "../../../core/validators/is-valid-phone-number.decorator";
import { LINKEDIN_URL_REGEX, VALID_TIMEZONES } from "./contact-field-validation";

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
  @IsValidPhoneNumber()
  mobileNo?: string;

  @IsOptional()
  @IsValidPhoneNumber()
  directPhoneNo?: string;

  @IsOptional()
  @Matches(LINKEDIN_URL_REGEX, { message: "linkedIn must be a valid linkedin.com URL" })
  linkedIn?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsIn(VALID_TIMEZONES, { message: "timezone must be a valid IANA timezone name" })
  timezone?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}
