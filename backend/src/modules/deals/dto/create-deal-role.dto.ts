import { CreateDealRoleRequest } from "@orelia/common";
import { MaxLength, MinLength, IsString } from "class-validator";

export class CreateDealRoleDto implements CreateDealRoleRequest {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;
}
