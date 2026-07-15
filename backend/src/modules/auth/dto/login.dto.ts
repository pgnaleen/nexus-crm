import { LoginRequest } from "@orelia/common";
import { IsString, MinLength } from "class-validator";

export class LoginDto implements LoginRequest {
  @IsString()
  tenantSlug!: string;

  @IsString()
  username!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
