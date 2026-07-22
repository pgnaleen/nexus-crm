import { VerifyPasswordRequest } from "@orelia/common";
import { IsString, MinLength } from "class-validator";

export class VerifyPasswordDto implements VerifyPasswordRequest {
  @IsString()
  @MinLength(1)
  password!: string;
}
