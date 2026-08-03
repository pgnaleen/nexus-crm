import { AssignDealRoleRequest } from "@orelia/common";
import { IsUUID } from "class-validator";

export class AssignDealRoleDto implements AssignDealRoleRequest {
  @IsUUID()
  roleId!: string;

  @IsUUID()
  userId!: string;
}
