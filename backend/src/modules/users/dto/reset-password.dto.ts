import { ResetPasswordRequest } from "@orelia/common";
import { IsString, MaxLength, MinLength } from "class-validator";

export class ResetPasswordDto implements ResetPasswordRequest {
  // bcrypt silently truncates input past 72 bytes -- reject longer passwords
  // outright rather than let them work while being effectively truncated.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
