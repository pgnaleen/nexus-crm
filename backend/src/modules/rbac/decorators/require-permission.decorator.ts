import { SetMetadata } from "@nestjs/common";

export const PERMISSION_KEY = "requiredPermission";
/**
 * Accepts either a single permission or an array. An array is OR semantics —
 * the request passes if the user holds ANY one of the listed permissions
 * (e.g. a detail-fetch endpoint shared by a read-only "view" flow and an
 * "update" flow that needs to see current values before editing).
 */
export const RequirePermission = (permission: string | string[]) =>
  SetMetadata(PERMISSION_KEY, permission);
