import { CreateRoleRequest } from "@orelia/common";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateRoleDto implements CreateRoleRequest {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;
}
