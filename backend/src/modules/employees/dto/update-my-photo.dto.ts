import { UpdateMyPhotoRequest } from "@orelia/common";
import { IsString, ValidateIf } from "class-validator";

// Self-service profile photo. Deliberately NOT a PartialType of
// UpdateEmployeeDto -- this route is auth-only (no EMPLOYEES_UPDATE), so the
// DTO must be incapable of carrying any other column. One field, nothing else.
export class UpdateMyPhotoDto implements UpdateMyPhotoRequest {
  // Explicit null clears the photo; a string sets it to a key returned by
  // POST /uploads/my-photo. ValidateIf lets null through while still rejecting
  // numbers/objects/undefined -- @IsOptional() would wrongly accept a missing
  // key, and "absent" must not silently mean "clear".
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  profilePhotoUrl!: string | null;
}
