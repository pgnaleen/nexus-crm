---
title: 'Activity Log — System Administration page'
type: 'feature'
created: '2026-07-31'
status: 'draft'
review_loop_iteration: 0
context: []
baseline_commit: 'c68b1452f46775bb22a19a304ad30f637ea6dd6a'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nexus CRM has recorded an audit trail since early in its life — `AuditLogService.record()`
is wired into create/update/delete across **23 entity types**, capturing who acted, when, and which
fields changed. **None of it has ever been readable.** `backend/src/core/audit-log/` holds an entity
and a service and nothing else: no controller, no module, no route. The only read path in the entire
codebase is `AuditLogService.findForEntity()`, called from exactly one place
(`PriorityTasksService.getHistory()`) to build one task's timeline. Nobody — including the platform
owner — can answer "who deleted that deal?" without opening `psql`.

Separately, **authentication is not audited at all.** `AuthService` never injects `AuditLogService`.
`users` carries only current-state columns (`last_logging_at`, `logging_attempts`, `locked_until`)
that are overwritten on the next attempt. Failed logins are never persisted. The single category of
event a security-conscious admin most wants to review leaves no history whatsoever.

**Approach:** A permission-gated **Activity Log** page under System Administration, scoped to the
viewer's own tenant, presenting two tabs — *Record Changes* (the existing `audit_logs`) and *Sign-in
Activity* (a new `auth_events` table) — with date-range, actor, module+action and free-text
filtering, server-side pagination, and a renderer that turns the raw `changes` JSON into readable
sentences.

## Decisions taken (product owner, 2026-07-31)

| Decision | Choice | Consequence |
|---|---|---|
| Log scope | Audit trail **+ login activity** | Login activity does not exist and must be built |
| Visibility | **Own tenant only** | No cross-tenant view in v1, even for the System tenant |
| Permission | **`AUDIT_LOG_VIEW` only** — one key | Deliberate exception to the four-permission rule; must be documented in `CLAUDE.md` |
| Filters | Date range, actor, module + action, free-text | Drives the index design and forces server-side filtering |
| Login events | Capture **IP address + user agent** | Makes it a genuine security log; IP is personal data, so retention matters |
| Retention | Design for scale now, purge later | Indexes + pagination now; no deletion in v1 |

## Boundaries & Constraints

**Always:**
- Tenant-scoped through `queryBuilderScoped()` (`BaseTenantRepository`) — the same mechanism as every
  other endpoint. A user must never see another tenant's rows.
- Resolve actor names with **one joined query per page**. Never per-row — see Edge Case 5.
- Auth-event capture is **best-effort and never throws**, matching `AuditLogService.record()`'s
  documented posture. A logging failure must never break login.
- Every user-facing string is a `t()` key in `frontend/src/locales/en.json` under a new
  `activityLog` namespace.
- Tailwind + FlyonUI utilities against `--color-crm-*` tokens; no hardcoded hex, no blue.
- Deep debug logging (entry / branch / result-shape / try-catch-rethrow) on every new controller and
  service method, per `CLAUDE.md`.
- Update `_bmad-output/2-current-work/api-endpoint-registry.md` in the same change.
- **Mock-first**: the UI is built on local state and signed off *before* any backend wiring
  (`feature-development-guideline.md` rule 1).

**Ask First:**
- Any cross-tenant read. The System tenant seeing all tenants' logs is explicitly deferred, not
  assumed.
- Any deletion or purge of audit rows.

**Never:**
- **Never record an attempted password**, not even hashed, in `auth_events`.
- Never add `AUDIT_LOG_CREATE`/`_UPDATE`/`_DELETE`. Audit rows are written only by the system; a
  delete permission would imply the trail can be erased.
- Never hide data the `changes` renderer didn't understand — unrecognised shapes fall back to raw
  JSON in the detail panel.
- Don't add foreign keys to `auth_events`. It mirrors `audit_logs`' deliberate no-FK stance so a row
  survives deletion of the user or tenant it references.
- Don't backfill audit coverage for the modules that lack it (see Other Case 2) — out of scope.
- Don't merge the two tabs into one `UNION`ed stream.

## I/O & Edge-Case Matrix

| # | Scenario | Input / State | Expected Behavior | Error Handling |
|---|---|---|---|---|
| 1 | Default view | Page opened, no filters | Most recent 50 rows of the viewer's own tenant, newest first | — |
| 2 | Cross-tenant attempt | User of tenant A, rows exist for tenant B | Zero tenant-B rows, at every filter combination | Enforced in the query, not the UI |
| 3 | Platform rows | `audit_logs.tenant_id IS NULL` (written when there is no tenant context) | **Invisible to everyone**, including the System tenant | Deliberate — see Other Case 4 |
| 4 | Deleted actor | `actor_id` points at a soft-deleted or missing user | Row still renders; actor shows "Unknown user" | `LEFT JOIN` yields NULL; never drop the row |
| 5 | Large result set | Tenant with 100k+ rows | Page loads on an index scan; one query per page regardless of row count | No N+1 — see the anti-pattern below |
| 6 | Unmapped entity type | A new `entity_type` with no label mapping | Degrades to humanised snake_case ("Deal Tender Details"), never a crash or a raw key | Fallback in the renderer |
| 7 | Unrecognised `changes` shape | JSON matching none of the five known shapes | Summary line still renders; detail panel shows raw JSON | Never blank, never throw |
| 8 | `changes` is NULL | Row written without a payload | Renders the action + entity only | — |
| 9 | Failed login, unknown username | Username that matches no user | `auth_events` row with `user_id` NULL, `username_attempted` as typed, `reason: unknown_user` | Deliberate — this is what credential-stuffing looks like |
| 10 | Failed login, unknown tenant | Tenant slug matches no tenant | **Not recorded** — there is no tenant to attribute it to, so no tenant could ever see it | Documented gap; slug-enumeration probes remain visible only in `RequestLoggerMiddleware` output |
| 11 | Audit write fails | DB error inside `record()` | Caller's operation still succeeds; a gap appears in the log | Pre-existing, by design — see Other Case 3 |
| 12 | Auth-event write fails | DB error during login capture | **Login still succeeds** | Swallow and log; never rethrow |
| 13 | Empty filter result | Filters match nothing | Empty state distinguishing "no activity yet" from "no matches" | Mirrors `departments.emptyState` |
| 14 | Timezone | Viewer in a different timezone to the app's display zone | See Edge Case 18 — this is subtler than it looks | `occurred_at` is `timestamptz`, so the DB side is already correct |
| 15 | **Sensitive field in `changes`** | An `employee` insert whose DTO spread carries NIC / passport / base salary | `"[redacted]"` **unless** the caller also holds `EMPLOYEES_VIEW_SENSITIVE` | Redacted **server-side**; the raw value must never reach the browser — see Other Case 6 |
| 16 | **Act-as-tenant actor** | A System admin acting as tenant X performs an action | Row is attributed to tenant X, actor renders as the fixed label "Platform administrator" | The System user's display name is **never** leaked into a tenant's log |
| 17 | **Same-microsecond rows** | Two rows share an `occurred_at` value | Stable order across pages | `ORDER BY occurred_at DESC, id DESC` — without the tiebreaker a row can appear on two pages or none |
| 18 | **Filter/display timezone mismatch** | User picks "since 09:00" in a `datetime-local` input | Filter boundary and displayed times use the **same** zone | Seven files already hardcode `Asia/Colombo`. A browser-local→UTC conversion while displaying Asia/Colombo makes "since 09:00" return rows from 03:30 |
| 19 | Login against an unknown tenant slug | Slug matches no tenant | **Not recorded** — no tenant to attribute it to, so no tenant could ever see it | Documented gap; visible only in `RequestLoggerMiddleware` output |
| 20 | Token refresh | `refresh()` fires every ~15 min per open tab | **Not recorded** | Deliberate — it would flood the timeline and drown real events |

</frozen-after-approval>

## Other cases identified

Six findings from the codebase exploration that materially affect this feature.

### 1. Four other history stores exist outside `audit_logs`

The page will **not** show these unless deliberately included. v1 does not.

| Store | Holds | Note |
|---|---|---|
| `deal_main_stage_history` / `deal_sub_stage_history` | Every deal stage move (`moved_by`, `moved_at`, `note`) | Deliberately writes **no** audit row — these rows *are* the trail. But `deals.service.ts` also writes an audit row for the status change, so **stage moves are half in each store** |
| `priority_task_flow` | Event-sourced task custody (placed/delegated/accepted/completed/archived/restored) | Append-only; no `tenant_id`, scoped via `task_id` |
| `priority_task_messages` | Task chat with edit/soft-delete | Body preserved server-side even when "deleted" |
| `refresh_tokens` | `created_at` / `revoked_at` per token | Effectively the only session ledger that exists today |

The stage-history split is worth resolving eventually so a deal's story isn't in two places. Its own
change, not this one.

### 2. Audit coverage has real gaps

These write **zero** audit rows: `AuthService`, `DocumentsService`, `UploadsController`,
`IndustriesService`, `DbBackupService`. And `companies`/`contacts` don't inject `AuditLogService`
at all — the `"company"`/`"contact"` rows that exist are written **only** by the relationship
services.

**Consequence:** the page will show no company or contact activity for edits made through the normal
company/contact paths. This feature makes those gaps visible for the first time, which is valuable,
but expect "why is nothing here?" questions. Backfilling coverage is out of scope.

### 3. The trail is best-effort by design

`record()` swallows every error and never rethrows (`audit-log.service.ts:62-72`). Correct — a failed
audit write must not roll back a real operation — but it means the log **can silently have gaps**.
The page must not be presented as guaranteed-complete.

### 4. `tenant_id` is nullable — but rarer than it looks

`record()` writes NULL when there is no tenant context. Under own-tenant scoping those rows are
invisible to everyone, because `WHERE tenant_id = :id` excludes NULL automatically (`NULL = x`
yields NULL, not true). No special-casing is needed — but it is recorded here as a **decision**, not
an accident.

**Correction to an earlier assumption:** Tenant CRUD is *not* one of these cases. `TenantsService`
runs on authenticated routes, so those rows carry the **System tenant's** id and correctly appear in
the System tenant's own log — accurate, since the System tenant did perform the action. NULL arises
only from code paths with **no request context at all**: seeds and scheduled jobs.

**Consequence:** any future cron job calling `record()` writes a permanently invisible row. The fix
when that happens is to give the job an explicit service-account tenant context — **not** to relax
the filter.

### 5. Actor names are an N+1 waiting to happen

`actor_id` is a bare uuid: no FK, no TypeORM relation. The only name resolution in the app,
`PriorityTasksService.getUserDisplayName()` (`priority-tasks.service.ts:541`), runs **one SELECT per
row inside a loop**. Acceptable for one task's history; catastrophic for a paginated log.

**Do not copy that pattern.** Use a single `LEFT JOIN users ON users.id = audit_logs.actor_id`.

### 6. 🔴 `changes` contains sensitive data — this page is a privilege-escalation path unless redacted

**The highest-severity finding, and it was missed in the first pass of this spec.**

`changes` for an insert is sometimes the **entire DTO spread** — `deals.service.ts:172` does
`{...dto, dealCode}`. CLAUDE.md gates NIC, passport number and base salary behind
`EMPLOYEES_VIEW_SENSITIVE`, but an `employee` insert's audit row holds all of them in plain `jsonb`.

Shipping this page without redaction means **anyone holding `AUDIT_LOG_VIEW` can read HR data they
are explicitly not entitled to**, simply by reading the audit trail instead of the employee record.
That defeats an access control the project already decided to enforce.

**Required — server-side, so the raw value never reaches the browser:**

```ts
const ALWAYS_REDACTED = new Set(["password","passwordHash","newPassword","token",
  "refreshToken","tokenHash","secret","graceToken"]);
const SENSITIVE_HR = new Set(["nic","nicNumber","passportNumber","baseSalary",
  "salary","bankAccountNumber"]);
```

`ALWAYS_REDACTED` → `"[redacted]"` unconditionally. `SENSITIVE_HR` → `"[redacted]"` **unless the
caller also holds `EMPLOYEES_VIEW_SENSITIVE`**. Redaction recurses into `{old, new}` pairs.

Redaction must happen in the service mapper, never in the frontend — a UI-only mask still ships the
value in the HTTP response.

**Residual, accepted:** free-text searches `changes::text` *before* redaction, so a targeted search
could confirm a value exists by whether a row comes back. Marginal; exclude redacted keys from the
searchable projection if it ever matters.

> This qualifies `AUDIT_LOG_VIEW`: it is not an unqualified all-access key, it is intersected with
> `EMPLOYEES_VIEW_SENSITIVE` for HR fields. That intersection is part of the permission decision.

### 7. Three tables are dormant

`notifications`, `reminders`, `deal_reviews` have entities and migrations but no service, controller
or module. Not in scope — noted so they aren't mistaken for something the log should cover.

## Design

### A. `auth_events` — a new table, not `audit_logs`

`audit_logs.action` is a Postgres enum of exactly `('insert','update','delete')` and the table has
nowhere to put an IP or user agent. Forcing auth events in would mean an `ALTER TYPE` plus two
columns that are NULL on ~99% of rows, inside a table whose meaning is "a record was mutated".

Auth events also behave differently: a brute-force attempt writes thousands of rows in minutes, and
an IP address is personal data wanting a *shorter* retention window than a business audit trail.

Two further facts settle this beyond doubt:

- **`audit_logs.entity_id` is `uuid NOT NULL`.** A failed login for a username that doesn't exist has
  no user id. Option A would force a sentinel uuid, corrupting the `(entity_type, entity_id)` index
  and the `findForEntity()` contract.
- **`login` runs on a `@Public()` route**, so `req.user` is undefined and `TenantContextService`
  yields no tenant. Every auth row written through `record()` would land with `tenant_id` NULL —
  **invisible in an own-tenant-only view**. Fixing that would mean changing `record()`'s signature
  across all 20 calling services.

```
auth_events
  id                  uuid PK
  tenant_id           uuid NOT NULL   -- always known: resolved from dto.tenantSlug
  user_id             uuid NULL       -- NULL when the username didn't resolve
  username_attempted  varchar(255)    -- as typed; the only trace when user_id is NULL
  event_type          enum('login_succeeded','login_failed','logout','account_locked')
  reason              varchar(32)     -- unknown_user | inactive | bad_password | locked_out
  ip_address          varchar(45)     -- v4 or v6 as text
  user_agent          varchar(512)
  occurred_at         timestamptz NOT NULL DEFAULT now()
```

Indexes: `(tenant_id, occurred_at DESC)`, `(tenant_id, user_id, occurred_at DESC)`,
`(tenant_id, event_type, occurred_at DESC)`. **No foreign keys.**

**Four event types, not six.** `password_changed` / `password_reset` deliberately stay where they
already are — `users.service.ts` L306 and L340 already write `audit_logs` rows
(`{passwordReset:true}`, `{passwordSelfChanged:true}`). Duplicating them here would double-count
them and require a `jsonb` key-existence predicate in the hot filter path for no real gain. They
remain fully visible under **module = Users**. `UsersService` needs no change at all.

**Capture points**, all branches that already exist in `auth.service.ts` `login()`:

| Event | Location | Notes |
|---|---|---|
| — | `if (!tenant)`, L58-62 | **Not recorded** — see Edge Case 19 |
| `login_failed` | `!user \|\| status !== Active`, L64-68 | `reason: user ? "inactive" : "unknown_user"` |
| `login_failed` | lockout still in force, L70-73 | `reason: "locked_out"` |
| `login_failed` | wrong password, L76-86 | `reason: "bad_password"`, **after** the `save()` at L84. Additionally writes `account_locked` when the L78 threshold branch fired |
| `login_succeeded` | success, L88-92 | After `save()`, before `issueSession()` |
| `logout` | `logout()`, L195-209 | Needs a restructure — see below |
| — | `refresh()` | **Not recorded** — Edge Case 20 |

**`logout()` requires one structural change.** It currently calls
`refreshTokenRepo.update({tokenHash}, {revokedAt})`, which never loads the row — so there is no
`userId`/`tenantId` to attribute the event to. Change to `findOneBy({tokenHash})` → set `revokedAt`
→ `save()` → record. One extra query on a rare endpoint, and it preserves the existing "missing or
stale token is not an error" behaviour (no row → no event, return normally).

`login()` runs **before** tenant context exists, so `tenant_id` comes from the resolved tenant, not
`TenantContextService` — which would throw. The new service's `record()` therefore takes `tenantId`
as an **explicit parameter**, unlike `AuditLogService`. That difference is the single thing a future
reader is most likely to get wrong; it needs a comment saying so.

**IP capture requires a platform change to be meaningful.** `main.ts` never calls
`app.set("trust proxy", …)`, so behind the nginx reverse proxy `req.ip` is the **proxy's** address,
not the client's. Add `app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS ?? 0))` plus a
validated `TRUST_PROXY_HOPS` env **defaulting to 0**. The default matters: blindly trusting
`x-forwarded-for` lets any client forge its own IP in the security log, which is worse than
recording the proxy's.

### B. Indexes on `audit_logs`

Today: only `(entity_type, entity_id)` and `(tenant_id)` — nothing on `occurred_at` or `actor_id`.
Every query this page makes would table-scan. Add:

- `(tenant_id, occurred_at DESC)` — the default list query; also lets `LIMIT` terminate early
- `(tenant_id, actor_id, occurred_at DESC)` — actor filter
- `(tenant_id, entity_type, occurred_at DESC)` — module filter

**And drop the existing `IDX_audit_logs_tenant`** — it becomes a strict prefix of the first new
index, so it is pure write overhead on a table every mutation in the app writes to. **Keep**
`IDX_audit_logs_entity (entity_type, entity_id)`; it still serves `findForEntity()` /
`PriorityTasksService.getHistory()`.

`action` is deliberately in **no** index — three distinct values makes it a heap predicate, not a
selective key.

**Free-text: do not ship a GIN index in the first migration.** The obvious reach is wrong — a GIN
index on `changes` (either `jsonb_ops` or `jsonb_path_ops`) supports key existence and containment,
**not substring**, which is what an admin typing a partial company name expects. The tool that works
is a trigram index over the text projection:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "IDX_audit_logs_changes_trgm"
  ON "audit_logs" USING gin ((changes::text) gin_trgm_ops);
```

But a trigram GIN over a whole jsonb-as-text column can approach the table's own size, and every
mutation in the app writes here. With the mandatory date range, Postgres will usually prefer the
`(tenant_id, occurred_at DESC)` btree and filter heap-side, never touching the GIN.

Ship free-text as a plain `ILIKE` on top of the date range. Add the trigram index as its own later
migration **only after** `EXPLAIN ANALYZE` on realistic volume shows it is actually slow. Record
that measurement gate in the migration comment.

### C. Backend — `backend/src/modules/activity-log/`

Follows `backend/src/modules/departments/` exactly: per-handler `@UseGuards(PermissionsGuard)` +
`@RequirePermission(PERMISSIONS.AUDIT_LOG_VIEW)`, a `Logger` with debug-in/debug-out/error-with-
rethrow, a private `toResponse()` mapper, module importing `TypeOrmModule.forFeature([...])` +
`RbacModule`, registered in `app.module.ts`.

All three are **RBAC routes**, not picker routes:

| Method | Path | Returns |
|---|---|---|
| `GET` | `/activity-log/audit` | `PaginatedResponse<AuditLogEntryResponse>` |
| `GET` | `/activity-log/auth` | `PaginatedResponse<AuthEventResponse>` |
| `GET` | `/activity-log/filters` | Actor + module options present in this tenant's rows |

**This is the first server-side pagination in the app.** `common/src/types/pagination.types.ts`
already defines `PageQuery` and `PaginatedResponse<T>` — currently **dead types with zero references
anywhere**. Adopt them rather than inventing new shapes; this gives them their first real use and
sets the pattern for the tables that will need it later.

`/filters` returns only actors and modules that actually appear in that tenant's rows, so a dropdown
can never offer a filter that returns nothing. **It must stay date-bounded** by the same window as
the current filter — an unbounded `SELECT DISTINCT` over the whole table is the sneaky full scan.

**`AuditLog` is a bare `@Entity`, not a `TenantOwnedEntity`, so the repository *cannot* extend
`BaseTenantRepository`.** Enforce the identical invariant by hand: inject `TenantContextService` and
append `tenant_id = :tenantId` unconditionally, in a single private method the class cannot bypass.
This needs a prominent comment — a reviewer will otherwise flag the missing base class as the bug.

Actor names come from `LEFT JOIN users ON users.id = actor_id` — **one query per page, never a
per-row lookup.** Two reasons the join beats collecting ids for a second `IN (…)` query: N+1 becomes
impossible *by construction* rather than by discipline, and **free-text must cover the actor's name**
(typing "Nimal" should return rows Nimal performed), which post-hoc resolution cannot do.

The join is deliberately **not** tenant-scoped and does **not** filter `deleted_at IS NULL` — raw SQL
bypasses TypeORM's soft-delete filter, which is what's wanted here, since an actor may have been
deleted since. But that makes act-as-tenant a real leak risk, so the query also selects the actor's
own `tenant_id`: when it differs from the current tenant, the mapper returns `actorName: null,
actorIsPlatform: true` and the UI renders a fixed **"Platform administrator"** label. A System user's
display name is never exposed inside a tenant's log. A genuinely dangling `actor_id` yields NULL →
"Unknown user", and the row is still shown.

**Ordering must be `occurred_at DESC, id DESC`.** The tiebreaker is mandatory, not cosmetic: without
it, two rows sharing a timestamp can swap between page 1 and page 2 and be shown twice or skipped.

**Cap the page number** (e.g. 500). Deep `OFFSET` degrades linearly and an unbounded `page` is a
trivial self-DoS; rejecting past the cap with "narrow the date range" is honest and cheap. Keyset
pagination on `(occurred_at, id)` is the better v2 answer but loses `total` and jump-to-page.

**Query-param gotchas.** The global `ValidationPipe` runs `forbidNonWhitelisted: true`, so the DTO
must declare every accepted param or the request 400s — and repeated params
(`?modules=a&modules=b`) arrive as a bare string when singular and an array when repeated. This is
the first endpoint in the codebase to take either, so it needs a normalizing `@Transform`.

### D. Permission — one key, documented as an exception

Add `AUDIT_LOG_VIEW: "audit_log:view"` to `common/src/constants/permissions.ts`. **No migration
needed**: `seedRbacResources()` (`seed.ts:94`) creates the `rbac_resources` row on the next seed run
and `seedSuperAdminRole()` (`seed.ts:132`) auto-grants it to Super Admin. Other roles are granted at
runtime through the existing Roles UI.

Supporting edits:
- `RESOURCE_DISPLAY_NAME` in `RolePermissionsDialog.tsx` (L36-53) — add `audit_log` → "Activity Log".
- `Sidebar.tsx` `ADMIN_ITEMS` (L87-93) — add `{ label, segment: "activity-log", prefix: "audit_log" }`.
  Gating is by **prefix** via `hasAnyPermissionForPrefix()`, so nothing else is required.

`CLAUDE.md` (Permission Model) and `feature-development-guideline.md` (rule 3) must both record this
exception in the same change, following the join-table and Priority-Deck-palette precedents, so it
stops being re-flagged on review.

**Do not** add it to `PLATFORM_ONLY_PERMISSIONS` — tenant admins must be able to hold it.
`riskLevelFor()` derives `Low` from the `view` suffix, which is correct.

> ⚠️ **Deployment trap.** The permission does not exist until `seed.ts` is re-run **in each
> environment**. Until then `PermissionsGuard` denies *everyone*, Super Admin included. This must be
> called out in the PR description and in the production deploy steps.

### E. Frontend — `frontend/src/app/[tenant]/(dashboard)/admin/activity-log/`

Structure copied from Departments (the documented i18n reference): `page.tsx` (server component,
`getServerSession` + initial fetch in `Promise.all`, computes `scopeKey` for acting-as-tenant
remount) + `_components/ActivityLogWidget.tsx` (client).

**Two tabs**, reusing `frontend/src/components/ui/PageTabs.tsx`: *Record Changes* and *Sign-in
Activity*. The sources have genuinely different columns, and a paginated `UNION` across two tables
with independent filters is both slow and easy to get subtly wrong.

**Filter bar** reuses what exists: the search-input markup repeated identically across
DepartmentsWidget / UsersTableWidget / companies, `CustomSelect` for module/action/actor (as
`companies/page.tsx` already does for Industry/Region), and a "Clear filters" button gated on
`hasFilters`. Filters drive **server** queries — the departure from every existing table, and the
reason pagination is required.

**Rendering `changes` in a readable way.** The JSON is verifiably *not* uniform:

| Shape | Origin | Rendered as |
|---|---|---|
| Flat snapshot | `insert` — `{username, displayName, status}` | "Created **User** — Jane Doe" + compact key/value list |
| Field diff `{f:{old,new}}` | `update` — the generic diff loop | "Updated **Deal**" + per-field `Name: "A" → "B"` |
| Boolean marker | `{passwordReset:true}`, `{passwordSelfChanged:true}` | "Reset the password" / "Changed their own password" |
| Id array | `{addedRoleIds:[…]}`, `{resourceIds:{old,new}}` (arrays) | "Roles added: Admin, Sales" / "Permissions changed: +3, −1" |
| Identifying snapshot | `delete` — `{name, dealCode}` | "Deleted **Deal** — DEAL-00042" |

A renderer module maps `entity_type` → friendly label (mirroring `RESOURCE_DISPLAY_NAME`'s approach)
and field names → readable labels, **falling back to humanised snake_case**. Each row expands to a
detail panel showing the raw JSON.

Classification runs **per top-level key of `changes`, not per action** — the same `action` carries
different shapes. Order: `{old,new}` pair where both are arrays → list delta; `{old,new}` otherwise →
diff; bare boolean on an update → flag; array under an `added*`/`removed*` key → list delta; anything
else → snapshot; unparseable → raw JSON. It must never throw.

**Join-table rows need their own phrasing.** For `deal_partner`, `priority_task_share` and
`relationship_company_contact_map`, `entity_id` is the *join row's* id, so an id-based fallback like
`#abc12345` is meaningless. Those get module-specific wording built from the snapshot keys
("Linked a partner to a deal"), never from the id.

**Timezone — the easy-to-miss bug.** Seven files already hardcode `timeZone: "Asia/Colombo"`. A
`<input type="datetime-local">` yields a **browser-local** wall-clock string; converting it to UTC
using the browser's zone while *displaying* results in Asia/Colombo means a user in another zone
filters "since 09:00" and gets rows from 03:30.

Fix: convert the picked wall-clock value **as Asia/Colombo** before sending, and label the column
"When (Asia/Colombo)" so it is unambiguous. Add a shared `frontend/src/lib/format-datetime.ts`
exporting `DISPLAY_TIMEZONE` / `formatDateTime()` / `wallClockToUtc()` rather than an eighth copy of
the hardcoded literal.

**Default the date range to the last 30 days** — both the sane default and the performance guardrail.
The empty state must then say *"showing the last 30 days — widen the range to see older activity"*,
or missing older rows reads as missing data.

**A disclaimer line under the page title is required**, not optional: the trail is best-effort and
several modules write no audit rows at all (Other Cases 2 and 3). Without it, "no company activity"
reads as "nobody edited any companies", which is false.

## Code Map

- `backend/src/database/migrations/<ts>-CreateAuthEventsAndAuditLogIndexes.ts` (new) — `auth_events`
  table + the three `audit_logs` indexes
- `backend/src/core/audit-log/auth-event.entity.ts` (new) — sits beside `audit-log.entity.ts`
- `backend/src/core/audit-log/auth-event.service.ts` (new) — `record()`, best-effort, never throws;
  registered in `CoreModule` alongside `AuditLogService`
- `backend/src/core/core.module.ts` — provide + export the new service
- `backend/src/modules/activity-log/` (new) — `activity-log.controller.ts`, `activity-log.service.ts`,
  `activity-log.module.ts`, `dto/query-activity-log.dto.ts`
- `backend/src/app.module.ts` — register `ActivityLogModule`
- `backend/src/modules/auth/auth.service.ts` — capture at the four points in §A; needs `req` for IP /
  user agent, so `login()`/`logout()` signatures gain a request-metadata argument passed from
  `auth.controller.ts`
- `backend/src/modules/users/users.service.ts` — capture `password_changed` / `password_reset`
- `common/src/constants/permissions.ts` — `AUDIT_LOG_VIEW`
- `common/src/contracts/activity-log.contracts.ts` (new) + `contracts/index.ts` export
- `common/src/enums/auth-event-type.enum.ts` (new) + `enums/index.ts` export
- `frontend/src/app/[tenant]/(dashboard)/admin/activity-log/page.tsx` (new)
- `frontend/src/app/[tenant]/(dashboard)/admin/activity-log/_components/ActivityLogWidget.tsx` (new)
- `frontend/src/app/[tenant]/(dashboard)/admin/activity-log/_components/changes-renderer.tsx` (new)
- `frontend/src/lib/api/activity-log.ts` (new) + `frontend/src/lib/activity-log/server.ts` (new)
- `frontend/src/components/layout/Sidebar.tsx` — `ADMIN_ITEMS` entry
- `frontend/src/components/layout/RolePermissionsDialog.tsx` — `RESOURCE_DISPLAY_NAME` entry
- `frontend/src/locales/en.json` — new `activityLog` namespace
- `CLAUDE.md`, `_bmad-output/1-epics-and-stories/feature-development-guideline.md` — record the
  one-permission exception
- `_bmad-output/2-current-work/api-endpoint-registry.md` — the three new endpoints

## Verification

Per `feature-development-guideline.md` §4 — all four required:

1. **Typecheck** — backend `pnpm --filter @orelia/backend typecheck` clean; frontend measured against
   the known **11-error baseline** (pre-existing, unrelated). No new errors.
2. **Browser** — apply each filter, page forward and back, expand a row, and confirm the renderer
   handles all five `changes` shapes **plus a deliberately unmapped `entity_type`**.
3. **`psql`** — tenant isolation is the single most important check: query as tenant A and confirm
   zero tenant-B rows. Then confirm `auth_events` rows for success / failure / lockout carry IP and
   user agent, and that `tenant_id IS NULL` rows are correctly invisible. Remove all test data and
   confirm removal.
4. **Regression** — an unrelated page (Departments or Users). Because `AuthService` is modified,
   **re-verify that login itself still works**, including the lockout path.

## Out of scope

Cross-tenant platform view · retention purge job · CSV export · resolving the
`deal_*_stage_history` half-in-each-store split · backfilling audit coverage for
companies/contacts/uploads · real-time streaming of new events.
