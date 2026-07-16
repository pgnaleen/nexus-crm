import { ITenant, IUser } from "../types";

export interface LoginRequest {
  tenantSlug: string;
  username: string;
  password: string;
}

export interface ActingTenant {
  id: string;
  name: string;
  slug: string;
}

export interface AuthSessionResponse {
  user: IUser;
  tenant: ITenant;
  roles: string[];
  /** Resource keys (matching PERMISSIONS.*) granted to the user via its roles. */
  permissions: string[];
  /** Set only while act-as-tenant is active -- `tenant` above always stays the caller's real tenant. */
  actingTenant: ActingTenant | null;
}

export type MeResponse = AuthSessionResponse;
export type LoginResponse = AuthSessionResponse;
