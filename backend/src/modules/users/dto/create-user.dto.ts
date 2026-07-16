import { CreateUserRequest, UserStatus } from "@orelia/common";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

const USERNAME_REGEX = /^[a-z0-9._-]+$/;

export class CreateUserDto implements CreateUserRequest {
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  @Matches(USERNAME_REGEX, { message: "Lowercase letters, numbers, dots, underscores, and hyphens only" })
  username!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName!: string;

  @IsEmail()
  loggingEmail!: string;

  // bcrypt silently truncates input past 72 bytes -- reject longer passwords
  // outright rather than let them work while being effectively truncated.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

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
}
