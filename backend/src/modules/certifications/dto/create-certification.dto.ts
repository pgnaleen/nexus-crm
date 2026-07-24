import { CreateCertificationRequest } from "@orelia/common";
import { IsDateString, IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";

// Story 1.12 -- self-reported claim. Evidence (file url / link) is optional
// at submit time by design; Story 1.13 enforces that a claim with neither
// cannot be Verified.
export class CreateCertificationDto implements CreateCertificationRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  issuingOrganization!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  credentialId?: string;

  @IsDateString()
  issueDate!: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  // A backend-relative upload path (from POST /uploads/certification), not an
  // arbitrary external URL -- so IsString, not IsUrl.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  evidenceFileUrl?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(2000)
  evidenceLink?: string;
}
