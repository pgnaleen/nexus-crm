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
  // Story 1.6 -- which Employee (HR record) this login account is tied to.
  // The link lives on employees.user_id and is only ever created/changed
  // from User Management; Employee Management shows it read-only.
  linkedEmployee: { id: string; fullName: string } | null;
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
  // Story 1.6 -- optionally link this new account to an existing Employee.
  // Rejected with 409 if that employee is already linked to another account.
  employeeId?: string;
}

export interface UpdateUserRequest {
  displayName?: string;
  loggingEmail?: string;
  status?: UserStatus;
  mustChangePassword?: boolean;
  extras?: string;
  roleIds?: string[];
  // Story 1.6 -- tri-state: absent = leave the link unchanged, null = unlink,
  // uuid = link to that employee (409 if linked to a different account).
  employeeId?: string | null;
}

export interface ResetPasswordRequest {
  password: string;
}

/** Self-service password change -- POST /users/me/change-password. */
export interface ChangeOwnPasswordRequest {
  currentPassword: string;
  newPassword: string;
}
