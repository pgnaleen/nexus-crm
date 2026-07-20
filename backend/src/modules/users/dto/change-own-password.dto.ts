import { ChangeOwnPasswordRequest } from "@orelia/common";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";
import { PASSWORD_STRENGTH_MESSAGE, PASSWORD_STRENGTH_REGEX } from "./password-policy";

export class ChangeOwnPasswordDto implements ChangeOwnPasswordRequest {
  @IsString()
  currentPassword!: string;

  // bcrypt silently truncates input past 72 bytes -- reject longer passwords
  // outright rather than let them work while being effectively truncated.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(PASSWORD_STRENGTH_REGEX, { message: PASSWORD_STRENGTH_MESSAGE })
  newPassword!: string;
}
