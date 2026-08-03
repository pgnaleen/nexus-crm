import { AuthEventReason, AuthEventType } from "../enums/auth-event-type.enum";

// Shared query shape for both /activity-log/audit and /activity-log/auth.
// Filters drive server-side queries (the first paginated endpoints in the
// app) -- see spec-activity-log.md section C. `modules`/`actions` accept
// either a single value or several (repeated query params); the backend DTO
// normalizes both shapes.
export interface ActivityLogQuery {
  page?: number;
  pageSize?: number;
  // ISO date strings, already converted to UTC from the picked Asia/Colombo
  // wall-clock value client-side -- see frontend/src/lib/format-datetime.ts.
  from?: string;
  to?: string;
  actorId?: string;
  modules?: string | string[];
  actions?: string | string[];
  search?: string;
}

export interface AuditLogEntryResponse {
  id: string;
  occurredAt: string;
  action: "insert" | "update" | "delete";
  entityType: string;
  entityId: string;
  // Null when actor_id is dangling (deleted/missing user) -- the row still
  // renders, with the frontend showing "Unknown user".
  actorId: string | null;
  actorName: string | null;
  // True when the actor belongs to a different tenant than the viewer (a
  // System admin acting-as this tenant). The UI must render the fixed label
  // "Platform administrator" instead of actorName in that case, never leak
  // the System user's real display name into a tenant's log.
  actorIsPlatform: boolean;
  // Redacted server-side before this ever leaves the backend -- see
  // spec-activity-log.md Other Case 6. Shape varies (see changes-renderer.tsx):
  // flat snapshot, {field: {old, new}} diff, boolean marker, or id array.
  changes: Record<string, unknown> | null;
}

export interface AuthEventResponse {
  id: string;
  occurredAt: string;
  eventType: AuthEventType;
  reason: AuthEventReason | null;
  userId: string | null;
  // As typed at the login form -- the only trace when userId is null
  // (unknown username).
  usernameAttempted: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface ActivityLogFilterOptionsResponse {
  actors: { id: string; name: string }[];
  modules: { value: string; label: string }[];
}
