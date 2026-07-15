import { IRbacResource, IRbacRole } from "../types";

export type RbacResourceResponse = IRbacResource;

export interface RbacRoleResponse extends IRbacRole {
  resourceCount: number;
}

export interface CreateRoleRequest {
  name: string;
  description?: string;
}

export type UpdateRoleRequest = Partial<CreateRoleRequest>;

export interface AssignRoleResourcesRequest {
  resourceIds: string[];
}
