import { UpdateCertificationRequest } from "@orelia/common";
import { IsDateString, IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";

// Story 1.12 -- edit a still-Pending claim. Tri-state per optional field
// (absent = unchanged, null = clear, value = set); @IsOptional() passes null
// through. name/issuingOrganization/issueDate keep their non-empty rules for
// when they ARE sent.
export class UpdateCertificationDto implements UpdateCertificationRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  issuingOrganization?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  credentialId?: string | null;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  evidenceFileUrl?: string | null;

  @IsOptional()
  @IsUrl()
  @MaxLength(2000)
  evidenceLink?: string | null;
}
