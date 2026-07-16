import { UpdateUserRequest } from "@orelia/common";
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateUserDto implements UpdateUserRequest {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsEmail()
  loggingEmail?: string;
}
