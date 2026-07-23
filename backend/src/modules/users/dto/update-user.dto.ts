import { UpdateUserRequest, UserStatus } from "@orelia/common";
import { ArrayUnique, IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class UpdateUserDto implements UpdateUserRequest {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsEmail()
  loggingEmail?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  extras?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  roleIds?: string[];

  // Story 1.6 -- tri-state: absent = leave the employee link unchanged,
  // null = unlink, uuid = link (409 if linked to a different account).
  // @IsOptional() skips validation for null as well as undefined.
  @IsOptional()
  @IsUUID()
  employeeId?: string | null;
}
