import type { RbacResourceResponse, RbacRoleResponse } from "@orelia/common";
import { serverFetch } from "../api/server-client";

export function listRoles(): Promise<RbacRoleResponse[] | null> {
  return serverFetch<RbacRoleResponse[]>("/rbac/roles");
}

export function listResources(): Promise<RbacResourceResponse[] | null> {
  return serverFetch<RbacResourceResponse[]>("/rbac/resources");
}
