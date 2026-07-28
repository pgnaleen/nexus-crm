import { RoleBuying, UpdateContactRequest } from "@orelia/common";
import { IsEmail, IsEnum, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from "class-validator";
import { IsValidPhoneNumber } from "../../../core/validators/is-valid-phone-number.decorator";
import { LINKEDIN_URL_REGEX, VALID_TIMEZONES } from "./contact-field-validation";

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
