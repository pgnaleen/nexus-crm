import { UserStatus } from "../enums";

/** List-view shape for User Management — gated by users:manage. */
export interface UserSummaryResponse {
  id: string;
  username: string;
  displayName: string;
  status: UserStatus;
  loggingEmail: string;
  lastLoggingAt: string | null;
}

/** Full record — served only by GET /users/:id, gated separately from the list. */
export interface UserResponse extends UserSummaryResponse {
  tenantId: string;
  loggingAttempts: number;
  lockedUntil: string | null;
  mustChangePassword: boolean;
  extras: string | null;
}

export interface CreateUserRequest {
  username: string;
  displayName: string;
  loggingEmail: string;
  password: string;
  status?: UserStatus;
  mustChangePassword?: boolean;
  extras?: string;
  roleIds?: string[];
}

export interface UpdateUserRequest {
  displayName?: string;
  loggingEmail?: string;
}
