// Four event types, not six -- password_changed/password_reset deliberately
// stay as audit_logs rows (users.service.ts already writes them), not
// duplicated here. See spec-activity-log.md section A.
export enum AuthEventType {
  LoginSucceeded = "login_succeeded",
  LoginFailed = "login_failed",
  Logout = "logout",
  AccountLocked = "account_locked",
}

// Only meaningful on LoginFailed rows.
export enum AuthEventReason {
  UnknownUser = "unknown_user",
  Inactive = "inactive",
  BadPassword = "bad_password",
  LockedOut = "locked_out",
}
