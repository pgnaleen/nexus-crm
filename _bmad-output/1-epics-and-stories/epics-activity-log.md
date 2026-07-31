---
stepsCompleted: ['1', '2']
inputDocuments: ['../3-feature-specs/spec-activity-log.md', 'CLAUDE.md', 'backend/src/core/audit-log/', 'backend/src/modules/auth/auth.service.ts']
---

# Nexus CRM — Activity Log Epic Breakdown

## Overview

User stories for the **Activity Log** — a System Administration page that makes the existing audit
trail readable for the first time, and fills the one gap in it by recording authentication events.

Opened **2026-07-31** after a codebase exploration established two facts:

1. `AuditLogService.record()` has been writing an audit trail across **23 entity types** since early
   in the project, and **it has never been readable**. `backend/src/core/audit-log/` contains an
   entity and a service and nothing else — no controller, no module, no route. The only read path in
   the codebase serves one priority-task timeline.
2. **Authentication is not audited at all.** `AuthService` never injects `AuditLogService`; `users`
   holds only current-state columns that are overwritten on the next attempt. Failed logins vanish.

The behavioural contract, the full edge-case matrix and the six *other cases* found during
exploration live in [`../3-feature-specs/spec-activity-log.md`](../3-feature-specs/spec-activity-log.md).
That spec is the input; this file is the work.

**Story order is deliberate and follows the project's mock-first rule**
([`feature-development-guideline.md`](./feature-development-guideline.md) rule 1): the UI is built on
local state and signed off *before* any backend wiring.

## Epic List

1. Activity Log — Audit Trail Visibility & Authentication Events

## Epic 1: Activity Log — Audit Trail Visibility & Authentication Events

> Globally this is **epic-7** in [`../2-current-work/sprint-status.yaml`](../2-current-work/sprint-status.yaml).
> Every epic file in this project calls its own epic "Epic 1"; BMad requires globally-unique numbers,
> so they are renumbered there. Story numbers inside this file are unchanged.

### Story 1.1: Activity Log page on mock data

As an **administrator**,
I want **to see the Activity Log page fully rendered before it is wired to real data**,
So that **the layout, filters and — most importantly — the way each kind of change is worded can be
corrected while it is still cheap to change**.

**Acceptance Criteria:**

**Given** the page is built against local mock state with no API calls
**When** it renders
**Then** it shows two tabs (*Record Changes*, *Sign-in Activity*) using the existing
`frontend/src/components/ui/PageTabs.tsx`, a filter bar, a table, and pagination controls

**Given** the `changes` payload is not uniform across the codebase
**When** the mock data includes **all five** known shapes — flat snapshot, field diff
`{f:{old,new}}`, boolean marker (`{passwordReset:true}`), id array (`{addedRoleIds:[…]}`,
`{resourceIds:{old,new}}`), and identifying snapshot
**Then** each renders as a readable sentence, and the wording of all five is explicitly signed off
before Story 1.4 begins

**Given** an `entity_type` with no label mapping
**When** it renders
**Then** it degrades to humanised snake_case ("Deal Tender Details") — never a crash, never a raw key

**Given** a row the renderer could not fully interpret
**When** the user expands it
**Then** a detail panel shows the **raw JSON** — data is never hidden because the renderer didn't
understand it

**Given** the i18n rule for new code
**When** the UI is reviewed
**Then** every string is a `t()` key in a new `activityLog` namespace in `en.json`, with zero
hardcoded text in JSX

**Given** this story is deliberately unwired
**When** it is reviewed
**Then** no backend file is touched and no API call exists

---

### Story 1.2: Permission and navigation

As an **administrator**,
I want **the Activity Log gated behind its own permission**,
So that **the record of who did what is visible only to people entitled to see it — it exposes every
other module's activity in one place**.

**Acceptance Criteria:**

**Given** audit rows are written only by the system and never by a user action
**When** the permission is defined
**Then** it is **`AUDIT_LOG_VIEW` alone** — no `_CREATE`, `_UPDATE` or `_DELETE`. A delete permission
would imply the trail can be erased, which defeats its purpose

**Given** this contradicts the standing four-permission rule
**When** the change ships
**Then** **both** `CLAUDE.md` (Permission Model) and `feature-development-guideline.md` (rule 3)
record the exception in the same change, following the existing join-table and Priority-Deck-palette
precedents, so it stops being re-flagged on review

**Given** permissions register through the seed, not a migration
**When** `seedRbacResources()` runs
**Then** the `rbac_resources` row is created and `seedSuperAdminRole()` auto-grants it to Super Admin

**Given** an administrator editing a role
**When** they open the permissions dialog
**Then** it appears under a readable "Activity Log" heading — requires a `RESOURCE_DISPLAY_NAME`
entry in `RolePermissionsDialog.tsx`, or it renders as the raw prefix

**Given** sidebar gating is by resource **prefix**
**When** the nav item is added with `prefix: "audit_log"`
**Then** it appears for users holding the permission and is hidden for those without — verified by
logging in as both

---

### Story 1.3: Schema — indexes and the auth events table

As a **developer**,
I want **the database able to answer the page's queries efficiently, and a place to record sign-ins**,
So that **the page stays fast as the trail grows into millions of rows, instead of degrading into
table scans**.

**Acceptance Criteria:**

**Given** `audit_logs` today has only `(entity_type, entity_id)` and `(tenant_id)` — nothing on
`occurred_at` or `actor_id`
**When** the migration runs
**Then** it adds `(tenant_id, occurred_at DESC)`, `(tenant_id, actor_id, occurred_at DESC)` and
`(tenant_id, entity_type, occurred_at DESC)`

**Given** the indexes must actually be used
**When** `EXPLAIN` is run on the default list query
**Then** it shows an index scan, not a sequential scan — verified against real data, not assumed

**Given** authentication events have no home
**When** the migration runs
**Then** `auth_events` is created with `id, tenant_id NULL, user_id NULL, username NOT NULL,
event_type enum, ip_address NULL, user_agent NULL, occurred_at timestamptz`, plus
`(tenant_id, occurred_at DESC)` and `(tenant_id, user_id, occurred_at DESC)`

**Given** an audit row must outlive what it references
**When** the table is created
**Then** it has **no foreign keys**, mirroring `audit_logs`' deliberate stance, so deleting a user or
tenant never rewrites history

**Given** a failed login for a username that does not exist
**When** the row is written
**Then** `user_id` is NULL and `username` holds what was actually typed — that pattern is precisely
what credential-stuffing looks like and must remain visible

---

### Story 1.4: Read API — filtered, paginated, tenant-scoped

As an **administrator**,
I want **the page's data served filtered and paginated from the server**,
So that **I can find a specific event among hundreds of thousands without the browser loading them
all**.

**Acceptance Criteria:**

**Given** three endpoints are added
**When** they are built
**Then** `GET /activity-log/audit`, `GET /activity-log/auth` and `GET /activity-log/filters` all sit
behind `AUDIT_LOG_VIEW` as **RBAC routes** — not picker routes

**Given** no endpoint in this app has ever paginated
**When** the response shape is chosen
**Then** it uses the existing `PaginatedResponse<T>` and `PageQuery` from
`common/src/types/pagination.types.ts` — currently **dead types with zero references** — rather than
inventing new ones, establishing the pattern for every table that will need it later

**Given** filtering must not happen in the browser
**When** date range, actor, module, action or free-text are applied
**Then** they are applied in SQL, and the returned `total` reflects the filtered count

**Given** `actor_id` is a bare uuid with no FK and no relation
**When** actor names are resolved
**Then** it is a **single `LEFT JOIN`** — one query per page regardless of row count. The per-row
lookup in `PriorityTasksService.getUserDisplayName()` must **not** be copied

**Given** an actor who has since been deleted
**When** their row renders
**Then** the row still appears, showing "Unknown user" — a dangling actor never drops the row

**Given** tenant isolation is the security boundary of this feature
**When** any endpoint is called by a user of tenant A
**Then** **zero** tenant-B rows are returned under every filter combination, enforced in the query
via `queryBuilderScoped()` and verified directly in `psql`

**Given** `audit_logs.tenant_id` is nullable
**When** those rows are queried
**Then** they are **invisible to every tenant, including System** — `WHERE tenant_id = :id` excludes
NULL automatically. A deliberate decision, not an oversight

**Given** `changes` for an insert is sometimes the entire DTO spread (`deals.service.ts:172`), so an
`employee` row can contain NIC, passport number and base salary — fields CLAUDE.md gates behind
`EMPLOYEES_VIEW_SENSITIVE`
**When** any row is returned
**Then** those fields are `"[redacted]"` **unless the caller also holds `EMPLOYEES_VIEW_SENSITIVE`**,
and credentials (`password`, `tokenHash`, `secret`, …) are redacted unconditionally.
**Redaction happens server-side** — verified by inspecting the raw HTTP response body, not the
rendered UI. Without this, `AUDIT_LOG_VIEW` is a privilege-escalation path into HR data

**Given** two rows can share an `occurred_at` value
**When** results are ordered
**Then** it is `occurred_at DESC, id DESC` — without the tiebreaker a row can appear on two pages or
be skipped entirely

**Given** a System administrator acting as this tenant performed an action
**When** the actor is resolved
**Then** it renders as the fixed label "Platform administrator" — the System user's display name is
**never** leaked into a tenant's log

**Given** filter dropdowns must not offer dead options
**When** `/activity-log/filters` responds
**Then** it returns only actors and modules that actually appear in that tenant's rows

---

### Story 1.5: Wire the page to the API

As an **administrator**,
I want **the signed-off UI showing real activity**,
So that **I can actually investigate what happened in my tenant**.

**Acceptance Criteria:**

**Given** the mock state from Story 1.1
**When** it is replaced with real fetches
**Then** the rendering agreed in 1.1 is unchanged — this story swaps the data source, not the design

**Given** a filter is changed
**When** the request is issued
**Then** results and the total update, paging resets to the first page, and rapid changes do not
leave a stale response rendered

**Given** no activity exists yet versus filters matching nothing
**When** the table is empty
**Then** the two cases show **different** empty states, mirroring `departments.emptyState`

**Given** the viewer may be in a different timezone to the server
**When** a timestamp renders
**Then** it shows local time with the absolute value on hover

---

### Story 1.6: Record authentication events

As an **administrator**,
I want **every sign-in, failed attempt and lockout recorded**,
So that **I can tell an ordinary mistyped password from someone attempting to break into an account
— which today leaves no trace at all**.

**Acceptance Criteria:**

**Given** `login()` already branches on lockout, wrong password and success
**When** each branch is taken
**Then** it writes `login_failed` (with a `reason` of `unknown_user` / `inactive` / `bad_password` /
`locked_out`), `account_locked` when the threshold branch fires, or `login_succeeded` — and
`logout()` writes `logout`

**Given** `users.service.ts` **already** writes audit rows for password changes
(`{passwordReset:true}` at L306, `{passwordSelfChanged:true}` at L340)
**When** the event types are defined
**Then** there are **four**, not six — no `password_changed`/`password_reset` duplicates, which would
double-count those events. They stay fully visible under module = Users, and `UsersService` needs no
change at all

**Given** `logout()` currently calls `refreshTokenRepo.update({tokenHash}, …)`, which never loads the
row and so has no `userId`/`tenantId` to attribute the event to
**When** it is changed
**Then** it becomes `findOneBy` → set `revokedAt` → `save()` → record, preserving the existing
behaviour that a missing or stale token is not an error

**Given** `refresh()` fires every ~15 minutes per open tab
**When** it runs
**Then** **nothing is recorded** — it would flood the timeline and drown the real events

**Given** the event is only useful if it identifies where it came from
**When** any event is written
**Then** it captures the **IP address and user agent** from the request

**Given** `main.ts` never calls `app.set("trust proxy", …)`, so behind nginx `req.ip` is the
**proxy's** address rather than the client's
**When** IP capture is added
**Then** `trust proxy` is configured from a new `TRUST_PROXY_HOPS` env var **defaulting to 0** —
blindly trusting `x-forwarded-for` would let any client forge its own IP in the security log, which
is worse than recording the proxy's

**Given** the password itself must never be retained
**When** a failed attempt is recorded
**Then** the attempted password is **never** stored, hashed or otherwise

**Given** a logging failure must never lock users out of the product
**When** the `auth_events` write throws
**Then** it is swallowed and logged, and **the login still succeeds** — matching
`AuditLogService.record()`'s documented best-effort posture

**Given** `login()` runs before tenant context exists
**When** `tenant_id` is set
**Then** it comes from the resolved tenant, not `TenantContextService` — which would throw

**Given** `AuthService` is being modified
**When** the story is verified
**Then** login, lockout after 5 failed attempts, and the forced-password-change gate are all
**re-verified working**, and the rows are confirmed in `psql` with IP and user agent populated

---

## Build order

| # | Story | Why here |
|---|---|---|
| 1 | 1.1 UI on mock data | Mock-first rule. The `changes` wording is the hardest part to get right and the cheapest to change before wiring |
| 2 | 1.2 Permission + navigation | Independent of the data; makes the page reachable and gated |
| 3 | 1.3 Schema | Unblocks 1.4; nothing reads it yet, so it can land safely on its own |
| 4 | 1.4 Read API | Needs 1.3's indexes to be verifiable as fast |
| 5 | 1.5 Wire up | Needs 1.1 and 1.4 |
| 6 | 1.6 Auth events | Last deliberately — it modifies `AuthService`, the highest-blast-radius file in the app. Everything else is proven working first, so a login regression is unambiguously attributable |

Stories 1.3 and 1.4 may run in parallel with 1.1–1.2 **only after** the mock UI is signed off.

## Deferred

Cross-tenant platform view (the System tenant seeing all tenants) · retention/purge policy, tracked
in [`../2-current-work/open-items.md`](../2-current-work/open-items.md) · CSV export · resolving the
`deal_*_stage_history` half-in-each-store split · backfilling audit coverage for the modules that
write no audit rows today (`AuthService` aside, this feature does not close that gap) · real-time
streaming.
