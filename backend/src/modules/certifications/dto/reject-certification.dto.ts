import { RejectCertificationRequest } from "@orelia/common";
import { IsString, MaxLength, MinLength } from "class-validator";

// Story 1.13 -- a rejection must carry a reason (the employee sees it on
// their profile). Required and non-empty.
export class RejectCertificationDto implements RejectCertificationRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  rejectionReason!: string;
}
