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
  // Cross-tenant viewing -- deliberate scope addition beyond the original
  // spec (which deferred this as "Ask First" / out of scope for v1). Only
  // ever honored when the backend independently confirms the caller is a
  // genuine System-tenant session (never act-as-tenant) -- a client-sent
  // flag alone must never be trusted to widen the query.
  //   - Neither set: scoped to the caller's own tenant (every non-System
  //     tenant; the only behavior they can ever get).
  //   - allTenants=true, tenantId unset: every tenant's rows, unfiltered.
  //   - tenantId set: that one tenant's rows specifically (allTenants ignored).
  allTenants?: boolean;
  tenantId?: string;
}

export interface AuditLogEntryResponse {
  id: string;
  occurredAt: string;
  action: "insert" | "update" | "delete";
  entityType: string;
  entityId: string;
  // Always present -- the row's actual owning tenant. Only rendered as its
  // own column when the viewer is a System-tenant session; for everyone
  // else it's always their own tenant, so showing it would be redundant.
  tenantId: string;
  tenantName: string;
  // Null when actor_id is dangling (deleted/missing user) -- the row still
  // renders, with the frontend showing "Unknown user".
  actorId: string | null;
  actorName: string | null;
  // True when the actor belongs to a different tenant than the ROW's own
  // tenant (a System admin acting-as this tenant performed the action). The
  // UI must render the fixed label "Platform administrator" instead of
  // actorName in that case, never leak the System user's real display name
  // into a tenant's log -- including when a System viewer browses another
  // tenant's rows directly via the cross-tenant view above.
  actorIsPlatform: boolean;
  // Redacted server-side before this ever leaves the backend -- see
  // spec-activity-log.md Other Case 6. Shape varies (see changes-renderer.tsx):
  // flat snapshot, {field: {old, new}} diff, boolean marker, or id array.
  changes: Record<string, unknown> | null;
}

export interface AuthEventResponse {
  id: string;
  occurredAt: string;
  tenantId: string;
  tenantName: string;
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
  // Present only when the caller is a System-tenant session -- the option
  // list for the cross-tenant Tenant filter. Absent (not empty) for every
  // other caller, so the frontend can distinguish "not applicable" from
  // "no other tenants exist yet".
  tenants?: { id: string; name: string }[];
}
