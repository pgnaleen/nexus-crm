# API Endpoint Registry

A single table-view reference for every backend endpoint in the system — what it is, what it's
for, what it sends/returns, and whether it's been brought up to the current logging standard.
The goal is that someone can understand the shape of the whole API surface by reading this file
alone, without having to open every controller.

**This file is built up section-by-section as each part of the system gets reviewed** (same pace
as the rest of this project — see the admin-section build process), not filled in all at once for
the entire codebase in one pass. Rows are added the moment an endpoint is created or changed, and
are grouped by feature/module below.

## Rule: keep this in sync

**Whenever a backend endpoint is created, moved, renamed, re-gated, or has its request/response
shape changed, update this table in the same change.** This is now a standing rule — see
`CLAUDE.md`. A registry that drifts from the real code is worse than no registry, because it
actively misleads.

## Column legend

- **Type** — `RBAC` (gated on the resource's own `_VIEW`/`_CREATE`/`_UPDATE`/`_DELETE`
  permissions) or `System-Internal (Picker)` (narrow lookup, gated on whatever the *consumer*
  screen holds, never the looked-up resource's own admin permission). See CLAUDE.md's "RBAC
  Routes vs. System-Internal (Picker) Routes".
- **Debug Logging** — ✅ endpoint + its service method(s) follow the "Deep debug logging inside
  every backend endpoint" rule (entry log, a line per branch taken, result-count log, try/catch
  with rethrow). ⬜ means it still needs the retrofit pass tracked in
  `todo-audit-infrastructure.md`. Scan this column to see what's left.

---

## Pickers module (`backend/src/modules/pickers/`)

Consolidated on 2026-07-21 — previously scattered one-per-resource across
`companies.controller.ts`, `contacts.controller.ts`, `employees.controller.ts`,
`industries.controller.ts`, and a route inside `departments.controller.ts`. All six below are new
routes as of this move (even where the underlying logic didn't change, the URL and/or permission
gate did) — see the consolidation writeup in `todo-audit-infrastructure.md` for the full history,
including which ones had a real pre-existing permission bug fixed during the move.

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/pickers/departments` | System-Internal (Picker) | `DEALS_VIEW` **or** `EMPLOYEES_CREATE` | Lightweight active-department list for a dropdown/filter (e.g. Add Deal dialog, Funnel department filter, Add Employee dialog's Employment tab). | none | `DepartmentPickerResponse[]` → `{id, name}[]` | `pickers.controller.ts::findDepartments` → `departments.service.ts::findPicker` | `lib/pickers/server.ts::listDepartmentsPicker` — Funnel page, Deal detail page, Add Employee dialog | ✅ | Moved from `GET /departments/picker`. **Bug fixed 2026-07-23**: was gated on `DEALS_VIEW` only — an `EMPLOYEES_CREATE` holder with no Deals access got an empty department dropdown in Add Employee. Add `EMPLOYEES_UPDATE` too once Update Employee (Story 1.4) exists. |
| 2 | GET | `/pickers/companies` | System-Internal (Picker) | `DEALS_VIEW` **or** any of `RELATIONSHIP_VIEW/CREATE/UPDATE/DELETE` | Searchable company list for a dropdown/search-select (Add Deal dialog's company field, Relationship party "Add Company" form). | query: `search?` (name filter), `excludeId?` (omit one company) | `CompanyPickerResponse[]` → `{id, name, country\|null}[]` | `pickers.controller.ts::findCompanies` → `companies.service.ts::findPicker` | `lib/pickers/server.ts` + `lib/api/pickers.ts::listCompaniesPicker` — Funnel, Deal detail, AddDealDialog, Relationships page | ✅ | Moved from `GET /companies/picker`. **Bug fixed**: was gated on `RELATIONSHIP_*` only — a Deals-only user got an empty dropdown. Now includes `DEALS_VIEW`. |
| 3 | GET | `/pickers/company-countries` | System-Internal (Picker) | `DEALS_VIEW` | Distinct list of country values already used by existing companies, for a country filter. | none | `string[]` | `pickers.controller.ts::findCompanyCountries` → `companies.service.ts::findCountries` | `lib/pickers/server.ts::listCompanyCountries` — Funnel page, Deal detail page | ✅ | Moved from `GET /companies/countries`. Gating unchanged. |
| 4 | GET | `/pickers/contacts` | System-Internal (Picker) | `DEALS_VIEW` | Contact list for a dropdown (Add Deal dialog's contact field), optionally scoped to one company. | query: `companyId?` | `ContactPickerResponse[]` → `{id, fullName, companyId\|null}[]` | `pickers.controller.ts::findContacts` → `contacts.service.ts::findPicker` | `lib/pickers/server.ts` + `lib/api/pickers.ts::listContactsPicker` — Funnel, Deal detail, AddDealDialog | ✅ | Moved from `GET /contacts/picker`. **Bug fixed**: was gated on `CONTACTS_VIEW` — the resource's own admin permission, a direct rule violation, since it's only ever called by Deals-side users. Now `DEALS_VIEW`. |
| 5 | GET | `/pickers/employees` | System-Internal (Picker) | `DEALS_VIEW` **or** any `RELATIONSHIP_*` | Employee list for a dropdown (Deal owner field, Relationship party referral field). | none | `EmployeePickerResponse[]` → `{id, fullName}[]` | `pickers.controller.ts::findEmployees` → `employees.service.ts::findPicker` | `lib/pickers/server.ts` + `lib/api/pickers.ts::listEmployeesPicker` — Funnel, Deal detail, Relationships page | ✅ | Moved from `GET /employees/picker`. **Bug fixed**, same pattern as #2 — added `DEALS_VIEW`. |
| 6 | GET | `/pickers/industries` | System-Internal (Picker) | `DEALS_VIEW` **or** any `RELATIONSHIP_*` | Full industry list for a dropdown (Company form's Industry field, used from both Deals and Relationships contexts). | none | `IndustryResponse[]` → `{id, name}[]` | `pickers.controller.ts::findIndustries` → `industries.service.ts::findAll` | `lib/pickers/server.ts::listIndustries` — Funnel, Deal detail, Relationships page | ✅ | Moved from `GET /industries`. **Bug fixed**, same pattern as #2. Distinct from `GET /tenants/industries` (Tenant Management's own admin-only industry list — untouched, out of scope here, correctly gated on `TENANTS_VIEW` since only Tenant admins reach that form). |

---

## Auth module (`backend/src/modules/auth/`)

**2026-07-22: full module now instrumented**, both layers, every method. Deliberately careful
never to log a plaintext password, raw access/refresh token, or token hash anywhere — only
presence/absence booleans, user/tenant ids, and (for refresh-token lookups) whether the token was
not-found/revoked/expired. **No `AuditLogService` calls added here** — login/refresh/logout are
session-lifecycle events, not CRUD mutations of a business entity, so they don't fit the audit
rollout's "significant entity mutation" scope (same reasoning already applied to
`deal-stage-history.service.ts`'s own exclusion).

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | POST | `/auth/login` | Public | none | Authenticate, issue access+refresh cookies. Tracks failed attempts, locks the account for 15 min after 5 in a row. | body: `{tenantSlug, username, password}` | `AuthSessionResponse` | `login` → `auth.service.ts::login` | Login page | ✅ | **2026-07-22**: added full entry/branch/result logging (tenant-not-found, user-not-found/inactive, locked-out, wrong-password-with-attempt-count, success) — had none before. Password never logged. |
| 2 | POST | `/auth/refresh` | Public (relies on the refresh cookie itself) | none | Rotate the refresh token, issue a new access+refresh pair. | cookie: refresh token | `AuthSessionResponse` | `refresh` → `auth.service.ts::refresh` | `middleware.ts` (proactive), `apiFetch`'s 401-retry path | ✅ | Logs only `tokenProvided` boolean and, on rejection, which of not-found/revoked/expired — never the raw token or its hash. |
| 3 | POST | `/auth/logout` | Auth-only | `JwtAuthGuard` | Revoke the current refresh token, clear all three cookies. | cookie: refresh token | `204 No Content` | `logout` → `auth.service.ts::logout` | `AccountMenu.tsx` | ✅ | Logs how many token rows were revoked (0 or 1), never the token itself. |
| 4 | GET | `/auth/me` | Auth-only | `JwtAuthGuard` | Fetch the current session (user, tenant, roles, permissions, acting-tenant). | none | `AuthSessionResponse` | `me` → `auth.service.ts::getSession` | `getServerSession()` on every page load | ✅ | Logs role/permission counts, not the actual permission strings (already available via other endpoints). |
| 5 | POST | `/auth/verify-password` | Auth-only | `JwtAuthGuard` | Confirms the *currently logged-in* user's own current password, without issuing new tokens — used to gate cascade-delete confirmations. | body: `{password}` | `{valid: boolean}` | `verifyPassword` → `auth.service.ts::verifyPassword` | `CascadeDeleteConfirmDialog` via `useCascadeDeleteConfirm()` | ✅ | Added 2026-07-21, already had logging. Password is also redacted in request logs by the existing `RequestLoggerMiddleware`. |
| 6 | POST | `/auth/act-as-tenant` | RBAC | `PLATFORM_IMPERSONATE_TENANT` | Issue a short-lived signed impersonation cookie for a System-tenant user acting as another tenant. | body: `{tenantId}` | `{tenant: ActingTenant}` | `actAsTenant` → `auth.service.ts::actAsTenant` | `TenantActingAsSwitcher.tsx` | ✅ | Already had an info-level audit-style log line (`this.logger.log`, kept as-is); now also has debug entry/blocked-branch/result logging matching every other endpoint. |
| 7 | POST | `/auth/exit-act-as-tenant` | Auth-only | `JwtAuthGuard` | Clear the impersonation cookie. | none | `204 No Content` | `exitActAsTenant` (controller-only, no service method) | `TenantActingAsSwitcher.tsx` | ✅ | **Verified live** (2026-07-22): exercised a wrong-password attempt (confirmed lockout counter incremented, no lockout yet), a correct login, a refresh, a verify-password, and a logout, all through the real API — confirmed the full debug-log trail at both layers with zero password/token/hash leakage anywhere in the output. |

---

## Relationship Types (`backend/src/modules/relationship-types/relationship-types.controller.ts`)

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/relationship-types` | RBAC | any of `RELATIONSHIP_TYPE_VIEW/CREATE/UPDATE/DELETE` | List every relationship type (Customer, Supplier, etc.) with its live tagged-party count. | none | `RelationshipTypeResponse[]` — `{id, name, tenantId, dependentCount, createdAt, updatedAt}[]` | `findAll` → `relationship-types.service.ts::findAllWithDependentCounts` | `RelationshipTypesWidget.tsx` (admin list) | ⬜ | `dependentCount` added 2026-07-21 for the cascade-delete warning below — one grouped `COUNT` query for the whole list, not per-row. |
| 2 | POST | `/relationship-types` | RBAC | `RELATIONSHIP_TYPE_CREATE` | Create a new relationship type. | body: `{name}` | `RelationshipTypeResponse` (`dependentCount` always `0` for a fresh type) | `create` → `relationship-types.service.ts::create` | `RelationshipTypeFormDialog.tsx` | ⬜ | |
| 3 | PATCH | `/relationship-types/:id` | RBAC | `RELATIONSHIP_TYPE_UPDATE` | Rename a relationship type. | body: `{name?}` | `RelationshipTypeResponse` | `update` → `relationship-types.service.ts::update` | `RelationshipTypeFormDialog.tsx` | ⬜ | |
| 4 | DELETE | `/relationship-types/:id` | RBAC | `RELATIONSHIP_TYPE_DELETE` | Delete a relationship type **and cascade-soft-delete every Company/Contact tagged under it.** | none | `{success: true}` | `remove` → `relationship-types.service.ts::remove` | `RelationshipTypesWidget.tsx` — via `useCascadeDeleteConfirm()` when `dependentCount > 0`, plain `useConfirm()` otherwise | ✅ | **Cascade-delete rule applied 2026-07-21**: runs inside one `dataSource.transaction` — soft-deletes every active `relationship_company_contact_map` row for this type (own `deletedBy` set) before soft-deleting the type itself. Underlying Company/Contact records are never touched, only the tagging row. See `todo-audit-infrastructure.md`'s dependent-relationship audit for why this one needed it and which others (Main Stages→Sub Stages, Teams→members) still do. |

---

---

## Main Stages / Sub Stages (`backend/src/modules/deal-stages/`)

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/main-stages` | RBAC | any of `MAIN_STAGE_VIEW/CREATE/UPDATE/DELETE` | List every Main Stage (funnel column groups) with its live Sub Stage count. | none | `MainStageResponse[]` — `{id, name, tenantId, position, dependentCount, createdAt, updatedAt}[]` | `findAll` → `main-stages.service.ts::findAllWithDependentCounts` | `MainStagesWidget.tsx` (admin list) | ✅ | `dependentCount` added 2026-07-21 for the cascade-delete warning below. |
| 2 | POST | `/main-stages` | RBAC | `MAIN_STAGE_CREATE` | Create a Main Stage. | body: `{name, position}` | `MainStageResponse` (`dependentCount` always `0`) | `create` → `main-stages.service.ts::create` | `MainStageFormDialog.tsx` | ✅ | |
| 3 | PATCH | `/main-stages/:id` | RBAC | `MAIN_STAGE_UPDATE` | Rename/reposition a Main Stage. | body: `{name?, position?}` | `MainStageResponse` | `update` → `main-stages.service.ts::update` | `MainStageFormDialog.tsx` | ✅ | |
| 4 | DELETE | `/main-stages/:id` | RBAC | `MAIN_STAGE_DELETE` | Delete a Main Stage **and cascade-soft-delete every Sub Stage under it** — blocked outright if any Deal currently sits in one of those Sub Stages. | none | `{success: true}` on success; `409 Conflict` with a message naming the blocking Deal count if blocked | `remove` → `main-stages.service.ts::remove` | `MainStagesWidget.tsx` — `useCascadeDeleteConfirm()` when `dependentCount > 0` | ✅ | **Cascade + block rule applied 2026-07-21**: soft-deletes affected Sub Stages inside one transaction, same shape as Relationship Types → parties. Additionally checks `Deal.currentStageId` (required, no `onDelete` action) across every Sub Stage about to be cascaded and refuses the whole delete if any active Deal is found — this is a **block**, not a cascade, since no Deal rows would ever get deleted, just left dangling if allowed through. |
| 5 | GET | `/sub-stages` | RBAC | any of `SUB_STAGE_VIEW/CREATE/UPDATE/DELETE` | List every Sub Stage (funnel columns within a Main Stage). | none | `DealStageResponse[]` — `{id, name, tenantId, sortOrder, isWon, isLost, mainStageId}[]` | `findAll` → `sub-stages.service.ts::findAll` | `SubStagesWidget.tsx`, `FunnelBoard.tsx` (via Deals) | ⬜ | Naming note: the contract type is called `DealStageResponse`, not `SubStageResponse` — pre-existing naming, not touched here. |
| 6 | POST | `/sub-stages` | RBAC | `SUB_STAGE_CREATE` | Create a Sub Stage under a Main Stage. | body: `{name, sortOrder, isWon?, isLost?, mainStageId}` | `DealStageResponse` | `create` → `sub-stages.service.ts::create` | `SubStageFormDialog.tsx` | ⬜ | |
| 7 | PATCH | `/sub-stages/:id` | RBAC | `SUB_STAGE_UPDATE` | Update a Sub Stage's fields. | body: partial of the above | `DealStageResponse` | `update` → `sub-stages.service.ts::update` | `SubStageFormDialog.tsx` | ⬜ | |
| 8 | DELETE | `/sub-stages/:id` | RBAC | `SUB_STAGE_DELETE` | Delete a single Sub Stage — **blocked** if any Deal currently sits in it. | none | `{success: true}` on success; `409 Conflict` if blocked | `remove` → `sub-stages.service.ts::remove` | `SubStagesWidget.tsx` | ✅ | **Block rule added 2026-07-21** (`countActiveDeals`), same reasoning/message shape as the Main Stage cascade's own check — this is the direct single-stage path, exercised independently of Main Stage deletion. |

---

## Deals (`backend/src/modules/deals/`)

Covers the create/update/view/delete path exercised by the "Add Deal" + "View Deal" +
"Update/Delete Deal" backend builds (2026-07-21/22) — the Stage-History sub-resource *permission
gating* isn't re-documented here (unchanged), just the fields/behavior that changed.

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | POST | `/deals` | RBAC | `DEALS_CREATE` | Create a deal — the full Add Deal dialog payload (customer, stage, owner, and every field below). | body: `CreateDealRequest` — name, dealType, companyId/contactId (exactly one required), primaryContactId?, sourceId?, ownerId, preSalesPersonId?, pmoId?, mainStageId?, currentStageId, departmentId?, dealCountry?, customerPainPoint?, product?, services?, estimatedValue?, internalCosts?, externalCosts?, expectedCloseDate?, competitors?: `{name, details}[]` | `DealResponse` (adds `preSalesPersonName`/`pmoName`/`sourceName`/`departmentName`/`primaryContactName`/`contactName` resolved display names alongside the existing `ownerName`/`companyName` pattern) | `deals.controller.ts::create` → `deals.service.ts::create` | `AddDealDialog.tsx` (`handleSubmit`, `mode="create"`) via `lib/api/deals.ts::createDeal` | ✅ | **Schema rework 2026-07-21**: removed `description`/`referredByCompanyId`/`referredByEmployeeId`/`probability`/`priority`/`currency` (confirmed zero references anywhere in `frontend/src` and zero seed data before removal); added the 9 fields above. `estimatedValue` doubles as the Costing tab's "Project Value without Tax" — Total Cost/Profit/Markup/Margin are deliberately never stored, only ever derived client-side from `estimatedValue`/`internalCosts`/`externalCosts`. `competitors` is a single `jsonb` column, not a table (per the frontend's own existing design comment — free-text blurbs, no need to query individually). |
| 2 | GET | `/deals/:id` | RBAC | `DEALS_VIEW` | Fetch one deal's full detail — every field above plus every resolved display name. | none | `DealResponse` | `deals.controller.ts::findOne` → `deals.service.ts::findOneOrFail` (relations-loaded variant) | `ViewDealDialog.tsx` via `lib/api/deals.ts::getDeal` | ✅ | Added 2026-07-21 alongside View Deal — `listDeals()` existed but no single-deal fetch did. `sourceName`/`departmentName`/`primaryContactName`/`contactName` added to `DealResponse` the same day (a real display gap found while building View Deal — those four were only ever returned as raw ids before). |
| 3 | PATCH | `/deals/:id` | RBAC | `DEALS_UPDATE` | Update any of the fields above on an existing deal — **except** `companyId`/`contactId`/`currentStageId`/`mainStageId` (Customer is locked after creation; Stage stays a drag-and-drop-only action so it never skips `DealStageHistory`). | body: `UpdateDealRequest` (all optional) | `DealResponse` | `deals.controller.ts::update` → `deals.service.ts::update` | `AddDealDialog.tsx` (`mode="edit"`, opened via View Deal's **Edit** button) via `lib/api/deals.ts::updateDeal` | ✅ | Records a field-level `{old, new}` diff to `audit_logs` (`entityType: "deal"`). **Critical bug found + fixed 2026-07-21**: see `CLAUDE.md`'s "TypeORM Gotcha" section — this endpoint (and `move`, below) were loading the Deal *with* relations for the mutation itself, which silently nulled every relation-backed FK column on every update. Fixed by splitting into a bare load for mutation (`findOneBareOrFail`) and a relations-loaded re-fetch only for the response. Edit mode's Documents/Partners tabs apply immediately via their own endpoints (rows 6-9 below), not batched into this PATCH. |
| 4 | POST | `/deals/:id/move` | RBAC | `DEALS_UPDATE` | Move a deal to a different Sub Stage (and Main Stage, if it crosses one), recording stage history. Also sets `deal.status` from the target Sub Stage's `isWon`/`isLost` flags. | body: `{toStageId, note?}` | `DealResponse` | `deals.controller.ts::move` → `deals.service.ts::moveStage` | `FunnelBoard.tsx` drag-and-drop | ✅ | Hit the same relation-nulling bug as `update` above, same fix applied. **2026-07-22**: added entry/branch/result debug logging (was completely unlogged) and an `audit_logs` update entry, but only when the move actually changes `status` (a same-stage-family move that doesn't cross a Won/Lost boundary correctly logs nothing, verified live). |
| 5 | GET | `/deals/:id/dependents-count` | RBAC | `DEALS_DELETE` | Returns how many Documents+Notes+Partners a delete would cascade to, for the confirmation warning. | none | `DealDependentsCountResponse` — `{count: number}` | `deals.controller.ts::dependentsCount` → `deals.service.ts::countDependents` | `ViewDealDialog.tsx`'s Delete button, right before opening `useCascadeDeleteConfirm()` | ✅ | Added 2026-07-22. Deliberately **not** a `dependentCount` field on the bulk `DealResponse` (unlike `RelationshipTypeResponse`/`MainStageResponse`) — `DealResponse` is fetched for the whole Funnel board on every page load, and this number is only relevant at the one moment someone opens the delete confirmation. |
| 6 | DELETE | `/deals/:id` | RBAC | `DEALS_DELETE` | Delete a deal **and cascade** — soft-deletes its Documents and Notes (each gets its own `deletedBy`), hard-deletes its Partner links (that table was never soft-deletable — matches its own existing remove path). Stage history is deliberately left untouched, a permanent record, not deal content. | none | `{success: true}` | `deals.controller.ts::remove` → `deals.service.ts::remove` | `ViewDealDialog.tsx`'s Delete button, via `useCascadeDeleteConfirm()` (password + warning naming the dependents count) then `lib/api/deals.ts::deleteDeal` | ✅ | Added 2026-07-22, same cascade-transaction shape as `relationship-types.service.ts`/`main-stages.service.ts`. Records an `audit_logs` `delete` entry. Verified via the real API with all three dependent kinds present. |

## Deal Documents (`deal-documents.controller.ts`, route `deals/:dealId/documents`) — Edit Deal additions

Endpoint shapes unchanged — just newly consumed by Edit Deal's Documents tab (uploads/deletes
apply immediately, not batched, since the deal already exists): `uploadDealDocument`/
`deleteDealDocument` (`lib/api/deals.ts`) called directly from `AddDealDialog.tsx`'s `mode="edit"`
document rows.

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/deals/:dealId/documents` | RBAC | `DEALS_VIEW` | List every document on a deal, newest first. | none | `DealDocumentResponse[]` | `findAll` → `deal-documents.service.ts::findAll` | `ViewDealDialog.tsx`, `AddDealDialog.tsx` (`mode="edit"`) | ✅ | **2026-07-22**: added entry/result debug logging and an `audit_logs` entity type (`deal_document`) — this endpoint family had zero logging or audit trail before. |
| 2 | POST | `/deals/:dealId/documents` | RBAC | `DEALS_UPDATE` | Upload a document, stored on local disk (`multer`), metadata row created. | multipart: `file`, `docType`, `title` | `DealDocumentResponse` | `create` → `deal-documents.service.ts::create` | `AddDealDialog.tsx` (both modes) | ✅ | Records an `audit_logs` insert (`entityType: "deal_document"`). Verified live via a real multipart upload. |
| 3 | DELETE | `/deals/:dealId/documents/:documentId` | RBAC | `DEALS_UPDATE` | Soft-delete a document. | none | `{success: true}` | `remove` → `deal-documents.service.ts::remove` | `AddDealDialog.tsx` (`mode="edit"`) | ✅ | Records an `audit_logs` delete entry. |

## Deal Partners (`deal-partners.controller.ts`, route `deals/:dealId/partners`) — Edit Deal additions

Endpoint shapes unchanged — same "applies immediately" treatment as Documents above, via
`addDealPartnerCompany`/`addDealPartnerContact`/`removeDealPartner` (`lib/api/deals.ts`) called
directly from `AddDealDialog.tsx`'s `mode="edit"` partner rows.

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/deals/:dealId/partners` | RBAC | `DEALS_VIEW` | List every company/contact partner on a deal. | none | `DealPartnerResponse[]` | `findAll` → `deal-partners.service.ts::findAll` | `ViewDealDialog.tsx`, `AddDealDialog.tsx` (`mode="edit"`) | ✅ | **2026-07-22**: added entry/branch/result debug logging and an `audit_logs` entity type (`deal_partner`) — zero logging or audit trail before. |
| 2 | POST | `/deals/:dealId/partners/companies` | RBAC | `DEALS_UPDATE` | Link a company as a deal partner (tenant-scoped lookup, rejects a duplicate link). | body: `{companyId}` | `DealPartnerResponse` | `addCompany` → `deal-partners.service.ts::addCompany` | `AddDealDialog.tsx` (both modes) | ✅ | Records an `audit_logs` insert. Verified live. |
| 3 | POST | `/deals/:dealId/partners/contacts` | RBAC | `DEALS_UPDATE` | Link a contact as a deal partner. | body: `{contactId}` | `DealPartnerResponse` | `addContact` → `deal-partners.service.ts::addContact` | `AddDealDialog.tsx` (both modes) | ✅ | Records an `audit_logs` insert. |
| 4 | DELETE | `/deals/:dealId/partners/:partnerId` | RBAC | `DEALS_UPDATE` | Unlink a partner. | none | `{success: true}` | `remove` → `deal-partners.service.ts::remove` | `AddDealDialog.tsx` (`mode="edit"`) | ✅ | **2026-07-22**: controller wasn't even passing the caller's user id through before — added `@CurrentUser()` to the route so `deletedBy`/`actorId` are real instead of always absent. Records an `audit_logs` delete entry. |

## Deal Stage History (`deal-stage-history.controller.ts`, route `deals/:dealId/stage-history`)

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/deals/:dealId/stage-history` | RBAC | `DEALS_VIEW` | List every Sub Stage + Main Stage move recorded for a deal. | none | `DealStageHistoryResponse[]` | `findAll` → `deal-stage-history.service.ts::listForDeal` | `DealStageHistoryDialog.tsx`, `DealStageHistoryRoadmap.tsx` | ✅ | **2026-07-22**: added entry/result debug logging. Deliberately **no** `audit_logs` entry for this service's own writes (`recordSubStageMove`/`recordMainStageMove`) — the history rows themselves already are the permanent audit trail for stage moves; a second `audit_logs` row recording "a history row was written" would be circular. |

## Deal Notes (`backend/src/modules/deals/deal-notes.controller.ts`, route `deals/:dealId/notes`)

New 2026-07-21, alongside the Add Deal backend build — the Notes tab's comment thread. Mirrors
`deal_documents`' tenant-scoping-via-parent-Deal pattern (`DealNote` has no `tenant_id` of its
own), plus a new author-ownership check `deal_documents` doesn't need.

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/deals/:dealId/notes` | RBAC | `DEALS_VIEW` | List every note on a deal, oldest first. | none | `DealNoteResponse[]` — `{id, dealId, text, authorId, authorName, createdAt, updatedAt}[]` | `findAll` → `deal-notes.service.ts::findAll` | Not yet wired — Add Deal dialog only ever *creates* notes (see #2); reading an existing deal's notes belongs to the still-parked View/Edit Deal screen | ✅ | |
| 2 | POST | `/deals/:dealId/notes` | RBAC | `DEALS_UPDATE` | Post a new note, authored by the caller. | body: `{text: string}` | `DealNoteResponse` | `create` → `deal-notes.service.ts::create` | `AddDealDialog.tsx` — posts every locally-composed draft note right after the deal itself is created (same `Promise.all` as Documents/Partners) | ✅ | Records an `audit_logs` insert (`entityType: "deal_note"`). |
| 3 | PATCH | `/deals/:dealId/notes/:noteId` | RBAC **+ ownership check** | `DEALS_UPDATE` | Edit an existing note's text. | body: `{text: string}` | `DealNoteResponse`; `403` if the caller isn't the note's author | `update` → `deal-notes.service.ts::update` | Not yet wired — same reason as #1 | ✅ | The permission guard only checks `DEALS_UPDATE`; the author-only rule (`note.createdBy !== user.sub` → `ForbiddenException`) is enforced inside the service, since it's an ownership rule, not a resource permission. Verified via the real API: created a second real user holding `DEALS_UPDATE` via a different role, confirmed their edit attempt on someone else's note returned `403` with the exact blocking reason in the debug log. Records an `audit_logs` update diff on success. |

---

## Departments (`backend/src/modules/departments/departments.controller.ts`)

`findAll` is gated on the union of all four Department permissions (any Department-admin visitor
can list them); the dropdown/filter listing used elsewhere in the app lives in
`PickersController` (`GET /pickers/departments`), not here.

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/departments` | RBAC | `DEPARTMENT_VIEW`/`_CREATE`/`_UPDATE`/`_DELETE` (any) | List every department. | none | `DepartmentResponse[]` | `findAll` → `departments.service.ts::findAll` | `DepartmentsWidget.tsx` | ✅ | **2026-07-22**: added debug logging at both controller and service layers — had none before. |
| 2 | POST | `/departments` | RBAC | `DEPARTMENT_CREATE` | Create a department. | body: `{name}` | `DepartmentResponse` | `create` → `departments.service.ts::create` | `DepartmentsWidget.tsx` (Add) | ✅ | Now records an `audit_logs` insert (`entityType: "department"`) — had no audit trail at all before. |
| 3 | PATCH | `/departments/:id` | RBAC | `DEPARTMENT_UPDATE` | Update a department's name/active state. | body: `{name?, isActive?}` | `DepartmentResponse` | `update` → `departments.service.ts::update` | `DepartmentsWidget.tsx` (Edit) | ✅ | Records an `audit_logs` update diff (field-level `{old, new}`). |
| 4 | DELETE | `/departments/:id` | RBAC | `DEPARTMENT_DELETE` | Soft-delete a department. | none | `{success: true}` | `remove` → `departments.service.ts::remove` | `DepartmentsWidget.tsx` (Delete) | ✅ | Records an `audit_logs` delete entry. Verified live: created, renamed, deleted a real department via the API, confirmed all three `audit_logs` rows and the full debug-log trail at both layers. |

## Employees (`backend/src/modules/employees/employees.controller.ts`)

Employee Management epic. Response is `EmployeeListItemResponse`, a deliberately narrow
directory-listing shape (id, fullName, title, departmentId/departmentName, employmentStatus) —
excludes every Confidential field the `Employee` entity/`IEmployee` type carries (NIC/passport,
base salary, etc.), same shape used for both the list and the create response. The dropdown/picker
listing used elsewhere in the app (Deal owner field, Relationship party referral field) lives in
`PickersController` (`GET /pickers/employees`), not here — see the Pickers module section above.

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/employees` | RBAC | `EMPLOYEES_VIEW` | List every employee in the tenant (directory view). | none | `EmployeeListItemResponse[]` | `findAll` → `employees.service.ts::findAll` | `EmployeesWidget.tsx` | ✅ | **2026-07-23**, built with debug logging from day one. Sidebar's "Human Resources" group is now gated on this permission — previously visible to every user regardless of permission. |
| 2 | POST | `/employees` | RBAC | `EMPLOYEES_CREATE` | Create a new employee (Story 1.2) — Personal, Employment, Contact tabs always; Confidential tab (NIC/passport, base salary) only if the caller also holds `EMPLOYEES_VIEW_SENSITIVE`. | body: `CreateEmployeeRequest` — fullName (required) + ~20 optional fields across the four tabs | `EmployeeListItemResponse` | `create` → `employees.service.ts::create` | `EmployeeFormDialog.tsx` (via `EmployeesWidget.tsx`'s "Add Employee") | ✅ | **New 2026-07-23**. `EMPLOYEES_VIEW_SENSITIVE` replaces the `EMPLOYEES_MANAGE_SENSITIVE` name used in the original `epics-hr.md` story text — renamed to satisfy this project's "no `_MANAGE` key" rule. The controller independently strips `nicPassportNumber`/`baseSalary` for any caller lacking that permission, regardless of request body content — never trusts the frontend's tab-hiding alone. `reportingManagerId` is deliberately never accepted here; every new employee starts unplaced, set exclusively via the future Organization Chart (Story 1.8). Records an `audit_logs` insert (`entityType: "employee"`). **Shape change 2026-07-23**: `title` is now `EmployeeTitle` (`mr`/`mrs`/`ms`/`miss`/`dr`), not free text — it's a salutation, distinct from `currentDesignation` (the actual job title/designation field). Migration `1784700000005-AlterEmployeesTitleToEnum.ts` converts the column and nulls out any pre-existing value that doesn't match one of the five enum values. |

## Uploads (`backend/src/modules/uploads/uploads.controller.ts`)

Each route is a narrow, single-purpose file upload returning `{url}` (a backend-relative path,
resolved client-side via `resolveUploadUrl()`) — no DB record, the caller stores the URL string on
whatever entity field needs it (e.g. `Company.logo`, `Employee.profilePhotoUrl`/`s3Key`). Only the
two Story 1.2 routes are documented here — `POST /uploads/logo` predates this registry's coverage
and isn't retrofitted as a side effect of unrelated work, per this project's own incremental-rollout
precedent.

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | POST | `/uploads/employee-photo` | RBAC | `EMPLOYEES_CREATE` | Upload an employee's profile photo (Personal tab). | multipart: `file` (PNG/JPEG/WebP, ≤5MB) | `UploadResponse` → `{url}` | `uploadEmployeePhoto` (no service layer — file-system + multer only, same pattern as the pre-existing logo upload) | `EmployeeFormDialog.tsx` | ⚠️ | **New 2026-07-23**. No debug logging (matches the pre-existing `uploadLogo` precedent this route was copied from — neither has a service layer to log from). Gated on `EMPLOYEES_CREATE` only; broaden to include `EMPLOYEES_UPDATE` once Update Employee (Story 1.4) exists. SVG deliberately excluded from the allow-list (unlike logo's), since SVG-upload XSS is already a tracked, unresolved finding for the logo route (`deferred-work.md`) — not repeated here. |
| 2 | POST | `/uploads/employee-cv` | RBAC | `EMPLOYEES_CREATE` | Upload an employee's CV (Employment tab). | multipart: `file` (PDF/DOC/DOCX, ≤20MB) | `UploadResponse` → `{url}` | `uploadEmployeeCv` | `EmployeeFormDialog.tsx` | ⚠️ | **New 2026-07-23**. Same notes as #1. |

## Deal Sources (`backend/src/modules/deal-sources/deal-sources.controller.ts`)

Identical shape to Departments above — same permission-union `findAll`, same CRUD pattern.

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/deal-sources` | RBAC | `DEAL_SOURCE_VIEW`/`_CREATE`/`_UPDATE`/`_DELETE` (any) | List every deal source. | none | `DealSourceResponse[]` | `findAll` → `deal-sources.service.ts::findAll` | `DealSourcesWidget.tsx` | ✅ | **2026-07-22**: added debug logging at both layers — had none before. |
| 2 | POST | `/deal-sources` | RBAC | `DEAL_SOURCE_CREATE` | Create a deal source. | body: `{name, category?}` | `DealSourceResponse` | `create` → `deal-sources.service.ts::create` | `DealSourcesWidget.tsx` (Add) | ✅ | Now records an `audit_logs` insert (`entityType: "deal_source"`). |
| 3 | PATCH | `/deal-sources/:id` | RBAC | `DEAL_SOURCE_UPDATE` | Update a deal source's name/category/active state. | body: `{name?, category?, isActive?}` | `DealSourceResponse` | `update` → `deal-sources.service.ts::update` | `DealSourcesWidget.tsx` (Edit) | ✅ | Records an `audit_logs` update diff. |
| 4 | DELETE | `/deal-sources/:id` | RBAC | `DEAL_SOURCE_DELETE` | Soft-delete a deal source. | none | `{success: true}` | `remove` → `deal-sources.service.ts::remove` | `DealSourcesWidget.tsx` (Delete) | ✅ | Records an `audit_logs` delete entry. Verified live via the real API — full debug-log trail at both layers, all three audit rows confirmed. |

## Teams (`backend/src/modules/teams/teams.controller.ts`)

Simpler permission model than Departments/Deal Sources above — each action gated on its own single
permission (`TEAMS_VIEW` for list) rather than a permission union.

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/teams` | RBAC | `TEAMS_VIEW` | List every team. | none | `TeamResponse[]` | `findAll` → `teams.service.ts::findAll` | Teams admin widget | ✅ | **2026-07-22**: added debug logging at both layers — had none before. |
| 2 | POST | `/teams` | RBAC | `TEAMS_CREATE` | Create a team. | body: `{name}` | `TeamResponse` | `create` → `teams.service.ts::create` | Teams admin widget (Add) | ✅ | Now records an `audit_logs` insert (`entityType: "team"`). |
| 3 | PATCH | `/teams/:id` | RBAC | `TEAMS_UPDATE` | Rename a team. | body: `{name?}` | `TeamResponse` | `update` → `teams.service.ts::update` | Teams admin widget (Edit) | ✅ | Records an `audit_logs` update diff. |
| 4 | DELETE | `/teams/:id` | RBAC | `TEAMS_DELETE` | Soft-delete a team. | none | `{success: true}` | `remove` → `teams.service.ts::remove` | Teams admin widget (Delete) | ✅ | Records an `audit_logs` delete entry. Verified live via the real API — full debug-log trail at both layers, all three audit rows confirmed. |

## Relationship Parties (`backend/src/modules/relationship-types/relationship-parties.controller.ts`)

Manages Company/Contact records tagged under a Relationship Type. Audit entries reference the
underlying `company`/`contact` entity for field-level changes, and a separate `relationship_party`
entity type for the tagging relationship itself (enable/disable/untag) — untagging never deletes
the underlying Company/Contact record, only the map row linking it to this Relationship Type.

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/relationship-types/:relationshipTypeId/parties` | RBAC | any `RELATIONSHIP_*` | List every company/contact tagged under a Relationship Type. | none | `RelationshipPartyResponse[]` | `findAll` → `relationship-parties.service.ts::findAllForType` | `RelationshipViewWidget.tsx` | ✅ | **2026-07-22**: added debug logging at both layers — had none before. |
| 2 | POST | `.../parties/companies` | RBAC | `RELATIONSHIP_CREATE` | Create a new Company (with optional inline Contacts, e.g. people who work there) tagged under this type, inside one transaction. | body: company fields + `contacts?: []` | `RelationshipPartyResponse` | `addCompany` → `relationship-parties.service.ts::addCompany` | `CompanyFormDialog.tsx` (create) | ✅ | Now records an `audit_logs` insert for the company, plus one per inline contact — had zero audit trail before. **2026-07-23 bug fix:** inline contacts no longer get their own `relationship_company_contact_map` row — they were previously double-counted as independent top-level parties of this relationship type (e.g. inflating a "Customer" list/count with the customer company's own employees). They're still created as `Contact` rows with `companyId` set; see endpoint #4 below for how they're read back. |
| 3 | POST | `.../parties/contacts` | RBAC | `RELATIONSHIP_CREATE` | Create a Contact tagged under this type — either a standalone/independent party (no `companyId`, gets its own party row), or an additional contact added to an *existing* company from its edit form (`companyId` set). | body: contact fields, `companyId?` | `RelationshipPartyResponse` | `addContact` → `relationship-parties.service.ts::addContact` | Contact-kind create flow; `CompanyFormDialog.tsx` (edit, adding a new contact) | ✅ | Records an `audit_logs` insert (`entityType: "contact"`) in both cases. **2026-07-23 bug fix:** when `companyId` is set, no party row is created (same fix as #2) — response is built directly from the contact, `id` is the contact's own id rather than a map row id. |
| 4 | GET | `.../parties/companies/:mapId/contacts` | RBAC | any `RELATIONSHIP_*` | List the Contacts belonging to a tagged Company (by its own `companyId`, not via any party row — added because of the #2/#3 bug fix, so a company's contacts stay visible/readable after creation). | none | `ContactResponse[]` | `listCompanyContacts` → `relationship-parties.service.ts::listContactsForCompany` | `CompanyFormDialog.tsx` (edit, "Existing contacts") | ✅ | **New 2026-07-23**, added with the bug fix. Read-only for now — no update/delete endpoint for an individual company-owned contact yet; editing an existing one isn't wired in the UI (tracked as a fast-follow, not done here). |
| 5 | PATCH | `.../parties/companies/:mapId` | RBAC | `RELATIONSHIP_UPDATE` | Update a tagged Company's fields. | body: partial company fields | `RelationshipPartyResponse` | `updateCompany` → `relationship-parties.service.ts::updateCompany` | `CompanyFormDialog.tsx` (edit) | ✅ | Records an `audit_logs` update diff (`entityType: "company"`). |
| 6 | PATCH | `.../parties/contacts/:mapId` | RBAC | `RELATIONSHIP_UPDATE` | Update a *standalone* tagged Contact's fields (not a company-owned one — those have no `mapId` to target, see #4). | body: partial contact fields | `RelationshipPartyResponse` | `updateContact` → `relationship-parties.service.ts::updateContact` | Contact-kind edit flow | ✅ | Records an `audit_logs` update diff (`entityType: "contact"`). |
| 7 | PATCH | `.../parties/:mapId/disable` | RBAC | `RELATIONSHIP_UPDATE` | Deactivate a tagging (party stays, `isActive: false`). | none | `RelationshipPartyResponse` | `disable` → `relationship-parties.service.ts::setActive(false)` | `RelationshipViewWidget.tsx` | ✅ | Records an `audit_logs` update (`entityType: "relationship_party"`, `{isActive: {old, new}}`) — only when the value actually flips. |
| 8 | PATCH | `.../parties/:mapId/enable` | RBAC | `RELATIONSHIP_UPDATE` | Reactivate a tagging. | none | `RelationshipPartyResponse` | `enable` → `relationship-parties.service.ts::setActive(true)` | `RelationshipViewWidget.tsx` | ✅ | Same as above. |
| 9 | DELETE | `.../parties/:mapId` | RBAC | `RELATIONSHIP_DELETE` | Untag a Company/Contact from this Relationship Type (soft-delete the map row only). | none | `{success: true}` | `remove` → `relationship-parties.service.ts::remove` | `RelationshipViewWidget.tsx` | ✅ | Records an `audit_logs` delete (`entityType: "relationship_party"`). **Verified live** (2026-07-22): created a real company with an inline contact, updated it, disabled, re-enabled, then removed it via the real API — confirmed the full debug-log trail at both layers and every audit row (company insert, contact insert, company update, two `relationship_party` update rows, one `relationship_party` delete row). |

## RBAC (`backend/src/modules/rbac/rbac.controller.ts`)

Role CRUD + permission assignment. Role-to-permission assignment audits against `entityType:
"rbac_role"` (`{resourceIds: {old, new}}`); user-to-role assignment audits against `entityType:
"user"` (see `assignRolesToUser`/`replaceRolesForUser`, called from the Users module, not this
controller directly).

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/rbac/roles` | RBAC | `RBAC_VIEW` | List every role with its permission count. | none | `RbacRoleResponse[]` | `findAllRoles` → `rbac.service.ts::findAllRoles` | Roles admin widget | ✅ | **2026-07-22**: added debug logging at both layers across the whole service — had none before. |
| 2 | GET | `/rbac/resources` | RBAC | `RBAC_VIEW` | List every permission assignable from the current tenant (platform-only ones filtered out unless acting as System). | none | `RbacResourceResponse[]` | `findAllResources` → `rbac.service.ts::findAllResources` | `RolePermissionsDialog.tsx` | ✅ | |
| 3 | GET | `/rbac/roles/:id/resources` | RBAC | `RBAC_VIEW` or `_UPDATE` | List the permission ids currently granted to a role. | none | `string[]` | `getRoleResourceIds` → `rbac.service.ts::getResourceIdsForRole` | `RolePermissionsDialog.tsx` | ✅ | |
| 4 | POST | `/rbac/roles` | RBAC | `RBAC_CREATE` | Create a role. | body: `{name, description?}` | `RbacRoleResponse` | `create` → `rbac.service.ts::createRole` | Roles admin widget (Add) | ✅ | Now records an `audit_logs` insert (`entityType: "rbac_role"`). |
| 5 | PATCH | `/rbac/roles/:id` | RBAC | `RBAC_UPDATE` | Rename/redescribe a role. | body: `{name?, description?}` | `RbacRoleResponse` | `update` → `rbac.service.ts::updateRole` | Roles admin widget (Edit) | ✅ | Records an `audit_logs` update diff. |
| 6 | PUT | `/rbac/roles/:id/resources` | RBAC | `RBAC_UPDATE` | Full-replace a role's permission set (also blocks assigning platform-only permissions from a non-System tenant). | body: `{resourceIds: string[]}` | `RbacRoleResponse` | `assignResources` → `rbac.service.ts::assignResourcesToRole` | `RolePermissionsDialog.tsx` (Save) | ✅ | Records an `audit_logs` update (`{resourceIds: {old, new}}`) — captures the full before/after set, not just a count. |
| 7 | DELETE | `/rbac/roles/:id` | RBAC | `RBAC_DELETE` | Delete a role. | none | `{success: true}` | `remove` → `rbac.service.ts::removeRole` | Roles admin widget (Delete) | ✅ | Records an `audit_logs` delete entry. **Verified live** (2026-07-22): created a real role, renamed it, assigned a real permission to it, deleted it, via the real API — confirmed the full debug-log trail at both layers and all four `audit_logs` rows. |

## Users (`backend/src/modules/users/users.controller.ts`)

Handles passwords and sessions — every log line and audit entry was written deliberately to never
include a plaintext password or password hash, matching the existing redaction precedent already
used by `RequestLoggerMiddleware` elsewhere in this codebase.

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/users` | RBAC | `USERS_VIEW` | List every user (summary shape). | none | `UserSummaryResponse[]` | `findAll` → `users.service.ts::findAll` | Users admin widget | ✅ | **2026-07-22**: added debug logging at both layers across the whole service — had none before. |
| 2 | GET | `/users/:id` | RBAC | `USERS_VIEW`/`_UPDATE` | Fetch one user's full detail. | none | `UserResponse` | `findOne` → `users.service.ts::findOneOrFail` | Edit User dialog | ✅ | |
| 3 | POST | `/users` | RBAC | `USERS_CREATE` | Create a user (optionally assigning roles). | body: `{username, displayName, loggingEmail, password, status?, mustChangePassword?, extras?, roleIds?}` | `UserResponse` | `create` → `users.service.ts::create` | Users admin widget (Add) | ✅ | Now records an `audit_logs` insert — deliberately excludes the password; only `username`/`displayName`/`status`. |
| 4 | PATCH | `/users/:id` | RBAC | `USERS_UPDATE` | Update a user's fields and/or full-replace their role set. | body: partial fields + `roleIds?` | `UserResponse` | `update` → `users.service.ts::update` | Edit User dialog | ✅ | Records an `audit_logs` update diff for the entity fields; `roleIds` (if present) is handled separately via `RbacService.replaceRolesForUser`, which audits against `entityType: "user"` itself. |
| 5 | GET | `/users/:id/roles` | RBAC | `USERS_VIEW`/`_UPDATE` | List a user's currently-assigned role ids. | none | `string[]` | `getRoleIds` → `rbac.service.ts::getRoleIdsForUser` | Edit User dialog | ✅ | |
| 6 | POST | `/users/:id/reset-password` | RBAC | `USERS_UPDATE` | Admin-initiated password reset (forces `mustChangePassword`). | body: `{password}` | `204 No Content` | `resetPassword` → `users.service.ts::resetPassword` | Users admin widget | ✅ | Records an `audit_logs` update with `{passwordReset: true, mustChangePassword: true}` — never the password itself. |
| 7 | POST | `/users/me/change-password` | Any authenticated user (no RBAC permission) | Self-service password change; revokes every other active session. | body: `{currentPassword, newPassword}` | `204 No Content` | `changeOwnPassword` → `users.service.ts::changeOwnPassword` | Profile page | ✅ | Records an `audit_logs` update with `{passwordSelfChanged: true}` — never a password. |
| 8 | PATCH | `/users/:id/disable` | RBAC | `USERS_DISABLE` | Disable a user and revoke all their active refresh tokens. | none | `UserResponse` | `disable` → `users.service.ts::disable` | Users admin widget | ✅ | Records an `audit_logs` status-change update. |
| 9 | PATCH | `/users/:id/enable` | RBAC | `USERS_DISABLE` | Re-enable a user. | none | `UserResponse` | `enable` → `users.service.ts::enable` | Users admin widget | ✅ | Records an `audit_logs` status-change update. |
| 10 | DELETE | `/users/:id` | RBAC | `USERS_DELETE` | Soft-delete a user. | none | `{success: true}` | `remove` → `users.service.ts::remove` | Users admin widget | ✅ | Records an `audit_logs` delete entry. **Verified live** (2026-07-22): created a real user, renamed it, reset its password, disabled, re-enabled, deleted it, via the real API — confirmed the full debug-log trail at both layers with zero password/hash leakage anywhere, and all six `audit_logs` rows. |

## Tenants (`backend/src/modules/tenants/tenants.controller.ts`)

**Real gap found and fixed here, not just missing logging**: `create()`/`update()` never set
`createdBy`/`updatedBy` at all (no `@CurrentUser()` even reached the service) — a direct violation
of the standing "no insert or update may leave createdBy/updatedBy unset" rule. `remove()` is a
genuine hard delete (cascades via `ON DELETE CASCADE` on every tenant-owned table's `tenant_id`
FK) — same shape as `deal-partners.service.ts`'s own hard-delete path, no `deletedBy` applies.

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/tenants/by-slug/:slug` | Public | none | Resolve a tenant's display name from its slug (login page). | none | `PublicTenantResponse` | `findBySlug` → `tenants.service.ts::findBySlugOrFail` | Login page | ✅ | **2026-07-22**: added debug logging at both layers across the whole service — had none before. |
| 2 | GET | `/tenants` | RBAC | `TENANTS_VIEW` | List every tenant (summary shape). | none | `TenantSummaryResponse[]` | `findAll` → `tenants.service.ts::findAll` | Tenants admin widget | ✅ | |
| 3 | GET | `/tenants/plans` | RBAC | `TENANTS_VIEW` | List available plans. | none | `PlanResponse[]` | `findAllPlans` → `tenants.service.ts::findAllPlans` | Tenant Add/Edit dialog | ✅ | |
| 4 | GET | `/tenants/industries` | RBAC | `TENANTS_VIEW` | List available industries. | none | `IndustryResponse[]` | `findAllIndustries` → `tenants.service.ts::findAllIndustries` | Tenant Add/Edit dialog | ✅ | |
| 5 | GET | `/tenants/:id` | RBAC | `TENANTS_VIEW`/`_UPDATE` | Fetch one tenant's full detail. | none | `TenantResponse` | `findOne` → `tenants.service.ts::findOneOrFail` | Tenant Edit dialog | ✅ | |
| 6 | POST | `/tenants` | RBAC | `TENANTS_CREATE` | Create a tenant. | body: `{name, slug, planId, status, phoneNo, contactEmail, industryId?, tagline?, billingEmail?, address?}` | `TenantResponse` | `create` → `tenants.service.ts::create` | Tenants admin widget (Add) | ✅ | **Fixed**: now passes `@CurrentUser()` through and sets `createdBy` (previously always null). Records an `audit_logs` insert. |
| 7 | PATCH | `/tenants/:id` | RBAC | `TENANTS_UPDATE` | Update a tenant's fields. | body: partial fields | `TenantResponse` | `update` → `tenants.service.ts::update` | Tenants admin widget (Edit) | ✅ | **Fixed**: now sets `updatedBy` (previously always null). Records an `audit_logs` update diff — verified the *actual database row* is unaffected by omitted fields (TypeORM correctly skips undefined columns), though the diff's JSON representation itself can show a stray old-only entry for a DTO field not sent in the request; same minor, pre-existing cosmetic imprecision shared by every other module's identical diff-computation pattern in this rollout, not a data-integrity issue. |
| 8 | DELETE | `/tenants/:id` | RBAC | `TENANTS_DELETE` | **Hard**-delete a tenant, cascading to every tenant-owned table. | none | `{success: true}` | `remove` → `tenants.service.ts::remove` | Tenants admin widget (Delete) | ✅ | Records an `audit_logs` delete entry before the row (and everything under it) is gone. **Verified live** (2026-07-22): created a real tenant, confirmed `created_by` was a real user id (previously always `null`), renamed it, confirmed `updated_by` was set and the untouched `phone_no`/`contact_email` columns survived intact in the database, deleted it — confirmed the full debug-log trail at both layers and all three `audit_logs` rows. |

*(Next section will be added once the rest of Auth is reviewed.)*
