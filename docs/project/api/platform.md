# API Endpoint Registry — Platform

Part of the split registry — see [`../api-endpoint-registry.md`](../api-endpoint-registry.md) for
the sync rule and column legend shared across every file in this folder.

---

## Uploads (`backend/src/modules/uploads/uploads.controller.ts`)

**Rewritten 2026-07-27** to fix a real correctness/durability gap: every route below previously
wrote to local disk (`multer.diskStorage`) with zero volume mounted in `docker-compose.yml`, so
every uploaded file would be lost on a real container recreation in production. All four routes
now buffer in memory (`multer.memoryStorage`) and upload to S3 via the shared `S3Service`
(`backend/src/core/storage/s3.service.ts`, registered globally through `CoreModule` — same bucket
as the DB-backup feature, `S3_BACKUPS_BUCKET`, distinguished by key prefix: `uploads/<type>/...`
vs. `db-backups/orelia/...`, see `core/storage/storage.constants.ts`). Objects are private (no
public-read policy); every response that surfaces a file link generates a fresh, short-lived
signed GET URL at response-build time from the stored key — never persists a URL anywhere.

**Response shape changed**: `UploadResponse` is now `{key, previewUrl}`, not `{url}`. `key` is the
stable, bare S3 key — this is what the frontend submits back as the field's value (`Company.logo`,
`Employee.profilePhotoUrl`/`s3Key` (cvUrl), `EmployeeCertification.evidenceFileUrl`). `previewUrl`
is a signed URL good only for immediate display in the same session (e.g. the image preview right
after picking a file) — it expires and must never be persisted. The entity fields that hold these
keys keep their existing (slightly historical) names; the corresponding response DTOs each gained
a sibling `*DisplayUrl` field (e.g. `CompanyResponse.logoDisplayUrl`,
`EmployeeDetailResponse.profilePhotoDisplayUrl`/`cvDisplayUrl`,
`CertificationResponse.evidenceFileDisplayUrl`) generated fresh on every GET — the base field is
never itself a fetchable URL anymore. `resolveUploadUrl()` (frontend, backend-relative-path
concatenation) is gone — every URL returned now is already absolute.

**Tenant isolation (2026-07-27, same-day follow-up)**: every key is now further namespaced by
tenant id — `uploads/<type>/{tenantId}/{uuid}.ext` (`core/storage/storage.constants.ts::tenantKeyPrefix`)
— not just the type-level prefix above. This closes a real gap: `Company.logo`,
`Employee.profilePhotoUrl`/`s3Key` (cvUrl), and `EmployeeCertification.evidenceFileUrl` are plain
client-supplied strings on their DTOs (`@IsString()` only, no format check), so without this, a
tenant could point their own record at any real key string they'd learned of — even another
tenant's — and get a valid signed URL for it; nothing enforced that a key actually belonged to the
tenant setting it. `assertKeyBelongsToTenant()` now runs before every such value is persisted
(`employees.service.ts::create`/`update`, `relationship-parties.service.ts::addCompany`/`updateCompany`,
`certifications.service.ts::createMine`/`updateMine`), rejecting a mismatched or pre-migration
flat key with `400 Bad Request`. Deal documents don't need this check — their `s3Key` is always
computed server-side from the just-uploaded file (see `deals.md`'s Deal Documents section), never
taken from client input, so there's no equivalent trust boundary to guard; the tenant segment was
still added there too, purely for consistent physical layout in the bucket.

`POST /uploads/logo` is included below now that it's been substantively changed (storage + response
shape) — previously undocumented per this project's incremental-rollout precedent, but a shape
change is exactly the trigger for adding registry coverage, not skipping it.

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | POST | `/uploads/logo` | RBAC | any `RELATIONSHIP_*` | Upload a Company logo (`CompanyFormDialog.tsx`, Business Details tab — despite the route name, this is Company branding, not tenant branding; no tenant-logo feature exists). | multipart: `file` (PNG/JPEG/WebP/SVG, ≤5MB) | `UploadResponse` → `{key, previewUrl}` | `uploadLogo` → `UploadsController::uploadAndRespond` (no separate service layer) | `CompanyFormDialog.tsx` | ✅ | **2026-07-27**: added `Logger` + entry/branch/result debug logging and try/catch-rethrow (had neither before); switched local disk → S3 (`LOGO_PREFIX`, flat — no per-company folder, since a logo can be uploaded before the company row exists on create). |
| 2 | POST | `/uploads/employee-photo` | RBAC | `EMPLOYEES_CREATE` or `EMPLOYEES_UPDATE` (any) | Upload an employee's profile photo (Personal tab, create or edit form). | multipart: `file` (PNG/JPEG/WebP, ≤5MB) | `UploadResponse` → `{key, previewUrl}` | `uploadEmployeePhoto` → `UploadsController::uploadAndRespond` | `EmployeeFormDialog.tsx` | ✅ | **2026-07-27**: added debug logging (previously none) and switched local disk → S3 (`EMPLOYEE_PHOTO_PREFIX`, flat). Old file now deleted from S3 on replace (`employees.service.ts::update`, best-effort) — was already correct pre-migration, just re-pointed at S3's `deleteObject` instead of a local `unlink`. |
| 3 | POST | `/uploads/employee-cv` | RBAC | `EMPLOYEES_CREATE` or `EMPLOYEES_UPDATE` (any) | Upload an employee's CV (Employment tab, create or edit form). | multipart: `file` (PDF/DOC/DOCX, ≤20MB) | `UploadResponse` → `{key, previewUrl}` | `uploadEmployeeCv` → `UploadsController::uploadAndRespond` | `EmployeeFormDialog.tsx` | ✅ | **2026-07-27**: same notes as #2. |
| 4 | POST | `/uploads/certification` | Any authenticated user (no RBAC permission) | Upload certificate evidence for a self-reported certification (Story 1.12). | multipart: `file` (PDF/PNG/JPEG/WebP, ≤10MB) | `UploadResponse` → `{key, previewUrl}` | `uploadCertification` → `UploadsController::uploadAndRespond` | `CertificationFormDialog.tsx` | ✅ | **2026-07-27**: added debug logging (previously none) and switched local disk → S3 (`CERTIFICATION_PREFIX`, flat). Old evidence file now deleted from S3 on replace (`updateMine`) or on delete (`deleteMine`) — previously never cleaned up at all, on either path. |
| 5 | POST | `/uploads/my-photo` | System-Internal (self-service) | None — any authenticated user | Upload the caller's own profile photo from My Profile. | multipart: `file` (PNG/JPEG/WebP, ≤5MB) | `UploadResponse` → `{key, previewUrl}` | `uploadMyPhoto` → `UploadsController::uploadAndRespond` | `ProfileAvatar.tsx` (via `lib/api/uploads.ts::uploadMyPhoto`) | ✅ | **New 2026-07-28**. Same segment, mime list and size cap as `#2 /uploads/employee-photo` — only the guard differs. Deliberately a separate route rather than relaxing #2: that one feeds a form that can target *any* employee, so it is correctly gated on `EMPLOYEES_CREATE`/`EMPLOYEES_UPDATE`, and a self-service user holds neither. Follows the `#4 /uploads/certification` precedent. The key returned here is inert on its own — `PATCH /employees/me/photo` (see `hr.md`) attaches it, and that route resolves the employee from the caller's token. |

---

## Activity Log (`backend/src/modules/activity-log/activity-log.controller.ts`)

New module, 2026-08-03 — built against `docs/project/specs/activity-log.md` (System
Administration page), mock-first per `feature-development-guideline.md`: the frontend
(`ActivityLogWidget.tsx`, under the "Settings" sidebar entry's "Audits" tab, alongside the
pre-existing Backups tab — see that page's own comment for why these two share one nav entry
instead of each getting its own) was built and signed off on local mock data before this backend
existed, then wired to the real endpoints below in the same pass this table row was added.

All three routes gated on the single `AUDIT_LOG_VIEW` key — a deliberate one-permission exception
to the project's normal four-permission (`_VIEW`/`_CREATE`/`_UPDATE`/`_DELETE`) rule, since audit
data is read-only by nature (see CLAUDE.md's Permission Model section). `AuditLog`/`AuthEvent` are
bare `@Entity` classes, not `TenantOwnedEntity`, so tenant scoping is hand-written in
`ActivityLogService.applyTenantScope()` rather than inherited from `BaseTenantRepository`. A
non-platform caller's `allTenants`/`tenantId` query params are always silently ignored server-side
regardless of what's sent — verified live by logging in as a real non-platform test user holding
only `AUDIT_LOG_VIEW` and confirming both params had zero effect on the result set.

`changes` in every audit-log row is redacted server-side before it ever leaves this service (see
`ActivityLogService`'s `ALWAYS_REDACTED`/`SENSITIVE_HR` sets) — `passwordHash`/`token`/etc. are
always redacted regardless of viewer; `nicPassportNumber`/`baseSalary` are redacted unless the
*viewer* (not the original actor) also holds `EMPLOYEES_VIEW_SENSITIVE`, mirroring
`EmployeesController.hasSensitiveAccess()` exactly. Verified live both ways: a viewer without
`EMPLOYEES_VIEW_SENSITIVE` got `"[redacted]"` for both HR fields and `passwordHash`; a Super Admin
(who holds it) got the real HR values back but still got `"[redacted]"` for `passwordHash` — the
always-redacted set is unconditional.

Auth events (`GET /activity-log/auth`) are populated by `AuthEventService.record()`, called from
`AuthService.login()`/`AuthService.logout()` (see `pickers-and-auth.md`'s Auth module section) at
every branch — unknown username, inactive account, still-locked-out, wrong password, the
exact-moment lockout is newly triggered, successful login, and logout. `AuthEventService.record()`
is best-effort, same posture as `AuditLogService.record()`: a failed write is logged and swallowed,
never fails the real login/logout it's attached to.

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/activity-log/audit` | RBAC | `AUDIT_LOG_VIEW` | Paginated, filterable record-change history (`audit_logs`). | query: `page?, pageSize?, from?, to?, actorId?, modules?, actions?, search?, allTenants?, tenantId?` (`ActivityLogQuery`) | `PaginatedResponse<AuditLogEntryResponse>` | `findAuditLog` → `activity-log.service.ts::findAuditLog` | `ActivityLogWidget.tsx` (Audits tab, via `lib/api/activity-log.ts::getAuditLog`) | ✅ | Defaults to the last 30 days when neither `from` nor `to` is sent — an unbounded date range would make every index on `audit_logs` useless. `actorName` resolved via a raw `LEFT JOIN users`, deliberately not tenant-scoped and not filtered on `deleted_at`, so a deleted or cross-tenant (platform) actor's row still renders correctly (`actorIsPlatform` flag). Verified live against the real dev DB: 217+ real rows, pagination, every filter, and both redaction cases (see module note above). |
| 2 | GET | `/activity-log/auth` | RBAC | `AUDIT_LOG_VIEW` | Paginated, filterable sign-in/sign-out history (`auth_events`). | query: same `ActivityLogQuery` shape as #1 (`modules`/`actions` accepted but not applicable — auth events have no entity type/action) | `PaginatedResponse<AuthEventResponse>` | `findAuthEvents` → `activity-log.service.ts::findAuthEvents` | `ActivityLogWidget.tsx` (Sign-in Activity tab, via `lib/api/activity-log.ts::getAuthEvents`) | ✅ | `search` matches `usernameAttempted` only. Verified live: real login-succeeded/login-failed (all 4 reasons)/account-locked/logout events, each with real captured `ipAddress`/`userAgent`. |
| 3 | GET | `/activity-log/filters` | RBAC | `AUDIT_LOG_VIEW` | Actor/module (and, platform-only, tenant) options actually present in the caller's scope + date range, so a filter dropdown never offers a choice that returns zero rows. | query: `from?, to?, allTenants?, tenantId?` (only the date/tenant-scope subset of `ActivityLogQuery`) | `ActivityLogFilterOptionsResponse` → `{actors: {id,name}[], modules: {value,label}[], tenants?: {id,name}[]}` | `findFilterOptions` → `activity-log.service.ts::findFilterOptions` | `ActivityLogWidget.tsx` (both tabs, via `lib/api/activity-log.ts::getActivityLogFilterOptions`) | ✅ | `tenants` present only for a genuine System-tenant session (never act-as-tenant) — absent, not empty, for everyone else, so the frontend can tell "not applicable" from "no other tenants exist yet". Same date-bounded scan as #1, for the same reason. |

**Cross-tenant viewing** (`allTenants`/`tenantId`) is a deliberate scope addition beyond
`docs/project/specs/activity-log.md`'s own v1 decision (which deferred it entirely) — added per an
explicit, separate product decision: every non-System tenant can only ever see its own activity;
the System tenant can see everything by default, or narrow to one tenant via the Tenant filter.
Verified live end to end: a real System-tenant Super Admin session got 220 rows with
`allTenants=true` (218 System + 2 Helix) and exactly 2 rows with `tenantId=<Helix>`; a real Helix
(non-platform) test user holding only `AUDIT_LOG_VIEW` got the identical 2-row Helix-only result
regardless of whether `allTenants=true` or a foreign `tenantId` was sent — confirming the
client-sent flags are never trusted, only ever honored after the server independently re-derives
platform status from the session itself.

---

## Dashboard (`backend/src/modules/dashboard/dashboard.controller.ts`)

New module, 2026-08-04 — closes the two gaps `DashboardWidgetGrid.tsx`'s own code comments and
Story 1.8 (`epics-system.md`) called out as deliberately deferred: (1) per-widget permission
filtering, now done one layer up in `dashboard/page.tsx` via
`frontend/src/components/widgets/widget-registry.tsx` (each widget declares the section-prefix(es)
its data belongs to; the page filters `WIDGET_REGISTRY` against the signed-in user's
`session.permissions` using the same `hasAnyPermissionForPrefix` rule `Sidebar.tsx` uses for nav
items — moved to `frontend/src/lib/permissions.ts` so both share one implementation), and (2)
backend-persisted layout/visibility, replacing what used to be `localStorage`-only state in
`DashboardWidgetGrid.tsx`.

Both routes gated by authentication only — no `PermissionsGuard`/`RequirePermission` — same access
model as Priority Tasks (see `priority-tasks.md`): every user reads and writes only their own
dashboard preferences, so there's no resource permission to gate on. One row per (tenant, user) in
`dashboard_preferences` (upserted, never append-only), extending `AuditedTenantEntity` per the
standing audit-columns rule.

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/dashboard/preferences` | Auth only (no RBAC permission) | none | The caller's own saved widget visibility + grid layout, or `null` if never saved. | none | `DashboardPreferenceResponse \| null` → `{visibleWidgetKeys: string[], layout: DashboardLayoutItem[]} \| null` | `getPreferences` → `dashboard-preferences.service.ts::getForUser` | `dashboard/page.tsx` (server-side fetch, passed into `DashboardWidgetGrid`) | ✅ | `null` means "no row yet" — the frontend falls back to `widget-registry.tsx`'s default layout/visibility (every permitted widget shown) in that case. |
| 2 | PUT | `/dashboard/preferences` | Auth only (no RBAC permission) | none | Upserts the caller's own widget visibility + grid layout. | body: `UpdateDashboardPreferenceRequest` → `{visibleWidgetKeys: string[], layout: DashboardLayoutItem[]}` | `DashboardPreferenceResponse` (same shape as #1, never null) | `updatePreferences` → `dashboard-preferences.service.ts::upsertForUser` | `DashboardWidgetGrid.tsx` (debounced save on layout/visibility change, replacing the old `localStorage.setItem` calls) | ✅ | One row per (tenant, user) — update-in-place via a bare (no-relations) load-then-save, never a second row. |

### Dashboard Metrics (`backend/src/modules/dashboard/dashboard-metrics.controller.ts`)

New, 2026-08-04 — real backend data for the ~11 dashboard widgets that have clear backing columns
in the schema, replacing their hardcoded `DUMMY_*` constants. Bundled by permission section (one
route per section, not per widget) to mirror `widget-registry.tsx`'s own grouping — a single fetch
per section serves every widget in it. `dashboard/page.tsx` only calls a bundle's route at all if
`getRequiredBundles()` says the permission-filtered widget list actually needs it, so a user
missing a section's permission never even triggers the guaranteed-403 call.

**Deliberately still dummy** (no query, no product decision made yet — see `docs/project/EPICS.md`'s
Epic 2 notes and `docs/project/PLANS.md`): `TargetRevenueGaugeWidget` (no quota/target table
anywhere in the schema), the Pipeline Coverage stat card (same missing denominator),
`WinLossReasonsChartWidget` (no win/loss reason field on Deal), `TeamPerformanceRadarWidget` (only
"deals closed" is derivable — response time/follow-ups/upsells/satisfaction have no backing
columns anywhere).

All money fields are normalized to USD server-side via the existing `FxRatesService.convert()` —
literally what it was built for, per its own comment ("Feeds the Sales Pipeline Dashboard's
cross-currency KPIs"). `salesFunnel` and `revenueTrend` are not separate queries — they reuse
`dealsByStage` and `revenueForecast`'s actual-revenue series respectively (same numbers, different
chart type).

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/dashboard/metrics/deals` | RBAC | `DEALS_VIEW` | Stat cards (totalDeals/pipelineValueUsd/winLossRatePercent/avgGpMarginPercent/salesVelocityDays), revenueForecast, dealsByStage, valueByStage, dealsBySource, dealsByDepartment, atRiskDeals. | query: `months?` (default 6, max 24) | `DealsMetricsResponse` | `getDealsMetrics` → `dashboard-metrics.service.ts::getDealsMetrics` | `dashboard/page.tsx` → `widget-registry.tsx::buildWidgetNodes` → stat cards, `RevenueForecastChartWidget`, `RevenueTrendChartWidget` (reuse), `DealsByStageChartWidget`, `ValueByStageChartWidget`, `SalesFunnelDiagramWidget` (reuse), `DealsBySourceStackedBarWidget`, `DealsByDepartmentChartWidget`, `AtRiskDealsListWidget` | ✅ | `avgGpMarginPercent` replicates `frontend/src/lib/deals/deal-display.ts::computeCosting`'s `marginPercent` formula server-side, so it matches a deal's own detail page. `revenueForecast.projected` uses `mainStage.weightPercent` (null treated as 0). At-risk threshold is a fixed 14-day constant (`AT_RISK_THRESHOLD_DAYS`), top 5 by days-stuck. Verified live against the real dev DB: 5 real deals, `pipelineValueUsd`/`avgGpMarginPercent`/`dealsByStage`/`valueByStage`/`atRiskDeals` all cross-checked against a direct `psql` query and matched exactly. |
| 2 | GET | `/dashboard/metrics/partners` | RBAC | `DEALS_VIEW` **AND** `RELATIONSHIP_VIEW` | Deal count grouped by company, restricted to companies tagged `systemRole=Partner` via `relationship_types`/`relationship_company_contact_map` (not just any company linked via `deal_partners_map`). | none | `PartnersMetricsResponse` | `getPartnersMetrics` → `dashboard-metrics.service.ts::getPartnersMetrics` | `PartnersInsightWidget` | ✅ | AND, not OR — `@RequirePermission`'s array is OR-only, so `RELATIONSHIP_VIEW` is checked by hand in the controller (`RbacService.getPermissionsForUser`), throwing `ForbiddenException` if missing, since Partners Insight blends two sections' data. Empty array (not an error) when no relationship type is flagged Partner yet. |
| 3 | GET | `/dashboard/metrics/tenants` | RBAC | `TENANTS_VIEW` | Tenants created per month — platform-wide, no tenant filter (matches what "Tenant Growth" already means). | query: `months?` (default 6, max 24) | `TenantsMetricsResponse` | `getTenantsMetrics` → `dashboard-metrics.service.ts::getTenantsMetrics` | `TenantGrowthChartWidget` | ✅ | Queries `tenants_registry` directly, unscoped by tenant — this is the one dashboard bundle that's inherently platform-wide. |
| 4 | GET | `/dashboard/metrics/users` | RBAC | `USERS_VIEW` | Users grouped by RBAC role. | none | `UsersMetricsResponse` | `getUsersMetrics` → `dashboard-metrics.service.ts::getUsersMetrics` | `UsersByRoleChartWidget` | ✅ | `rbac_role_user_map` is many-to-many — a user holding 2 roles is counted once per role, not deduplicated across roles. |
| 5 | GET | `/dashboard/metrics/tasks` | Auth only (no RBAC permission) | none | % of this tenant's Priority Tasks completed, tenant-wide (every other Priority Tasks query in the codebase is per-user). | none | `TasksMetricsResponse` → `{completedCount, activeCount, completionPercent}` | `getTasksMetrics` → `dashboard-metrics.service.ts::getTasksMetrics` | `TaskCompletionDonutWidget` | ✅ | Resolves each task's CANONICAL current status the same way `PriorityTasksService.resolveCanonicalView` does (a board/holder-type row always wins over a `delegated` tracker row for the same task) via `DISTINCT ON` — a naive `GROUP BY event_type` would double-count a task that's simultaneously tracked (delegator) and held (recipient). Archived tasks excluded from both numerator and denominator. |
