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
| 1 | GET | `/pickers/departments` | System-Internal (Picker) | `DEALS_VIEW` | Lightweight active-department list for a dropdown/filter (e.g. Add Deal dialog, Funnel department filter) — **not** the admin section's own department list. | none | `DepartmentPickerResponse[]` → `{id, name}[]` | `pickers.controller.ts::findDepartments` → `departments.service.ts::findPicker` | `lib/pickers/server.ts::listDepartmentsPicker` — Funnel page, Deal detail page | ✅ | Moved from `GET /departments/picker`. Gating unchanged. |
| 2 | GET | `/pickers/companies` | System-Internal (Picker) | `DEALS_VIEW` **or** any of `RELATIONSHIP_VIEW/CREATE/UPDATE/DELETE` | Searchable company list for a dropdown/search-select (Add Deal dialog's company field, Relationship party "Add Company" form). | query: `search?` (name filter), `excludeId?` (omit one company) | `CompanyPickerResponse[]` → `{id, name, country\|null}[]` | `pickers.controller.ts::findCompanies` → `companies.service.ts::findPicker` | `lib/pickers/server.ts` + `lib/api/pickers.ts::listCompaniesPicker` — Funnel, Deal detail, AddDealDialog, Relationships page | ✅ | Moved from `GET /companies/picker`. **Bug fixed**: was gated on `RELATIONSHIP_*` only — a Deals-only user got an empty dropdown. Now includes `DEALS_VIEW`. |
| 3 | GET | `/pickers/company-countries` | System-Internal (Picker) | `DEALS_VIEW` | Distinct list of country values already used by existing companies, for a country filter. | none | `string[]` | `pickers.controller.ts::findCompanyCountries` → `companies.service.ts::findCountries` | `lib/pickers/server.ts::listCompanyCountries` — Funnel page, Deal detail page | ✅ | Moved from `GET /companies/countries`. Gating unchanged. |
| 4 | GET | `/pickers/contacts` | System-Internal (Picker) | `DEALS_VIEW` | Contact list for a dropdown (Add Deal dialog's contact field), optionally scoped to one company. | query: `companyId?` | `ContactPickerResponse[]` → `{id, fullName, companyId\|null}[]` | `pickers.controller.ts::findContacts` → `contacts.service.ts::findPicker` | `lib/pickers/server.ts` + `lib/api/pickers.ts::listContactsPicker` — Funnel, Deal detail, AddDealDialog | ✅ | Moved from `GET /contacts/picker`. **Bug fixed**: was gated on `CONTACTS_VIEW` — the resource's own admin permission, a direct rule violation, since it's only ever called by Deals-side users. Now `DEALS_VIEW`. |
| 5 | GET | `/pickers/employees` | System-Internal (Picker) | `DEALS_VIEW` **or** any `RELATIONSHIP_*` | Employee list for a dropdown (Deal owner field, Relationship party referral field). | none | `EmployeePickerResponse[]` → `{id, fullName}[]` | `pickers.controller.ts::findEmployees` → `employees.service.ts::findPicker` | `lib/pickers/server.ts` + `lib/api/pickers.ts::listEmployeesPicker` — Funnel, Deal detail, Relationships page | ✅ | Moved from `GET /employees/picker`. **Bug fixed**, same pattern as #2 — added `DEALS_VIEW`. |
| 6 | GET | `/pickers/industries` | System-Internal (Picker) | `DEALS_VIEW` **or** any `RELATIONSHIP_*` | Full industry list for a dropdown (Company form's Industry field, used from both Deals and Relationships contexts). | none | `IndustryResponse[]` → `{id, name}[]` | `pickers.controller.ts::findIndustries` → `industries.service.ts::findAll` | `lib/pickers/server.ts::listIndustries` — Funnel, Deal detail, Relationships page | ✅ | Moved from `GET /industries`. **Bug fixed**, same pattern as #2. Distinct from `GET /tenants/industries` (Tenant Management's own admin-only industry list — untouched, out of scope here, correctly gated on `TENANTS_VIEW` since only Tenant admins reach that form). |

---

## Auth module (`backend/src/modules/auth/`)

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | POST | `/auth/verify-password` | RBAC (auth-only — no resource permission, just "must be logged in") | none beyond `JwtAuthGuard` | Confirms the *currently logged-in* user's own current password, without issuing new tokens — used to gate cascade-delete confirmations. | body: `{ password: string }` | `{ valid: boolean }` | `auth.controller.ts::verifyPassword` → `auth.service.ts::verifyPassword` | `lib/api/auth.ts::verifyPassword` — `CascadeDeleteConfirmDialog` via `DialogProvider`'s `useCascadeDeleteConfirm()` | ✅ | Added 2026-07-21 alongside the password-confirm cascade-delete dialog. Reuses the same `bcrypt.compare` check as `login()`. Password is redacted in request logs automatically (existing `RequestLoggerMiddleware` redaction already covers this field name). |

*(This registry entry list is far from a full audit of the Auth module — `/auth/login`,
`/auth/refresh`, `/auth/logout`, `/auth/me`, `/auth/act-as-tenant`, `/auth/exit-act-as-tenant` all
predate this document and haven't been added yet. They'll be added when Auth gets its own review
pass, same as every other not-yet-covered module below.)*

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

## Deal Sources (`backend/src/modules/deal-sources/deal-sources.controller.ts`)

Identical shape to Departments above — same permission-union `findAll`, same CRUD pattern.

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/deal-sources` | RBAC | `DEAL_SOURCE_VIEW`/`_CREATE`/`_UPDATE`/`_DELETE` (any) | List every deal source. | none | `DealSourceResponse[]` | `findAll` → `deal-sources.service.ts::findAll` | `DealSourcesWidget.tsx` | ✅ | **2026-07-22**: added debug logging at both layers — had none before. |
| 2 | POST | `/deal-sources` | RBAC | `DEAL_SOURCE_CREATE` | Create a deal source. | body: `{name, category?}` | `DealSourceResponse` | `create` → `deal-sources.service.ts::create` | `DealSourcesWidget.tsx` (Add) | ✅ | Now records an `audit_logs` insert (`entityType: "deal_source"`). |
| 3 | PATCH | `/deal-sources/:id` | RBAC | `DEAL_SOURCE_UPDATE` | Update a deal source's name/category/active state. | body: `{name?, category?, isActive?}` | `DealSourceResponse` | `update` → `deal-sources.service.ts::update` | `DealSourcesWidget.tsx` (Edit) | ✅ | Records an `audit_logs` update diff. |
| 4 | DELETE | `/deal-sources/:id` | RBAC | `DEAL_SOURCE_DELETE` | Soft-delete a deal source. | none | `{success: true}` | `remove` → `deal-sources.service.ts::remove` | `DealSourcesWidget.tsx` (Delete) | ✅ | Records an `audit_logs` delete entry. Verified live via the real API — full debug-log trail at both layers, all three audit rows confirmed. |

*(Next sections will be added as each part of the system is reviewed — Teams, Relationship
Parties, RBAC, Users, Tenants, the rest of Auth — in whatever order the user chooses to go through
them.)*
