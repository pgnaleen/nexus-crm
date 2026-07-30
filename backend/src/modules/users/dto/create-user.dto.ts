import { CreateUserRequest, UserStatus } from "@orelia/common";
import {
  ArrayUnique,
  IsArray,
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

  // No password field -- see CreateUserRequest's comment. UsersService.create()
  // generates a random temporary password itself.

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  extras?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  roleIds?: string[];

  // Story 1.6 -- optionally link this new account to an existing Employee
  // (employees.user_id). 409 if that employee is already linked elsewhere.
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}
