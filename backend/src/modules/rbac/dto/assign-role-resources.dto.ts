import { AssignRoleResourcesRequest } from "@orelia/common";
import { IsArray, IsUUID } from "class-validator";

export class AssignRoleResourcesDto implements AssignRoleResourcesRequest {
  @IsArray()
  @IsUUID(undefined, { each: true })
  resourceIds!: string[];
}
