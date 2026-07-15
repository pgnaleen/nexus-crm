import { ITenant, IUser } from "../types";

export interface LoginRequest {
  tenantSlug: string;
  username: string;
  password: string;
}

export interface AuthSessionResponse {
  user: IUser;
  tenant: ITenant;
  roles: string[];
  /** Resource keys (matching PERMISSIONS.*) granted to the user via its roles. */
  permissions: string[];
}

export type MeResponse = AuthSessionResponse;
export type LoginResponse = AuthSessionResponse;
