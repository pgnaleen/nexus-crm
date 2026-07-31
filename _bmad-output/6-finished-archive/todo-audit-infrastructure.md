# Todo — Audit, Logging & API Infrastructure (one-time build)

These are one-time setup tasks that make the standing rules in `CLAUDE.md` (sections "Audit,
Deletion & Logging Rules" and "Dropdown/Picker Data APIs") fully true. Each item ships on its own
— do not batch these together.

- [x] **Add `deletedBy` column.** ✅ Done.
  Added `deletedBy?: string` (uuid, nullable) to `backend/src/core/audited.entity.ts` and
  `backend/src/core/tenant/audited-tenant.entity.ts`, alongside the existing `createdBy`/
  `updatedBy` pattern. Migration `1784700000000-AddDeletedByColumn.ts` adds `deleted_by uuid null`
  + `ON DELETE SET NULL` FK to `users(id)` on 21 tables; a second migration
  (`1784700000001-AddDeletedByToUsers.ts`) covers `users` separately since that entity hand-rolls
  its own audit columns instead of extending the base classes.
  Wired into every repository's `softRemoveScoped` (departments, deal-sources, main-stages,
  sub-stages, teams, relationship-types, relationship-parties, rbac-roles, deals, users) and
  `deal-documents.service.ts`'s plain-repository delete path.
  **Bug found + fixed during verification**: setting `entity.deletedBy = actorId` on the in-memory
  entity right before `repo.softRemove(entity)` never actually persisted — TypeORM's `softRemove()`
  runs a `SoftDeleteQueryBuilder` that only ever writes the delete-date column, silently discarding
  every other dirty property. Fix: call `repo.softRemove(entity)` for the soft-delete itself, then a
  separate `repo.update(entity.id, { deletedBy: actorId })` to actually persist it. Applied to all
  10 repositories + the one plain-service path. Verified end-to-end via the real API (login, create,
  delete, then a direct `psql` join from `deleted_by` to `users.username`) — confirmed the deleting
  user's username now shows up correctly.
  Entity-only modules with no delete flow yet (companies, contacts, employees, notifications,
  reminders, deal_reviews, deal_tender_details) and genuine hard-deletes (`tenants.service.ts`,
  `deal-partners.service.ts`) are correctly out of scope — nothing to wire there.

- [x] **Create the `audit_logs` table + `AuditLogService`.** ✅ Done (infra + first rollout).
  Table created via `1784700000002-CreateAuditLogs.ts`: `id`, `tenant_id` (nullable — platform-
  level actions aren't scoped to one tenant), `entity_type`, `entity_id`, `action` (Postgres enum
  `insert|update|delete`), `actor_id`, `occurred_at` (default now), `changes` (jsonb). Deliberately
  **no FK** on `tenant_id`/`actor_id` — an audit entry is a historical record and must survive the
  tenant/user it references being deleted later, unlike the live operational `createdBy`/
  `deletedBy` columns elsewhere.
  `AuditLogService` (`backend/src/core/audit-log/audit-log.service.ts`) is registered in the
  already-`@Global()` `CoreModule`, so any service can inject it with zero extra module wiring.
  Its `record({entityType, entityId, action, actorId, changes})` is the one deliberate exception
  to this project's "never swallow, always rethrow" rule: a failure writing an audit row is logged
  as an error but never rethrown, since audit logging is best-effort observability sitting
  alongside the real operation, not something the caller's actual create/update/delete should ever
  fail because of.
  **First rollout**: `relationship-types.service.ts`'s `create`/`update`/`remove` — insert records
  a full snapshot, update records a field-level `{old, new}` diff (only for fields that actually
  changed), delete records a snapshot plus how many dependent party rows got cascaded with it.
  Verified via the real API: created, renamed, then deleted a type, confirmed via `psql` all three
  `audit_logs` rows landed with the correct `action`/`actor_id`/`changes` shape, plus the full
  debug-log trail.
  **Second rollout** (2026-07-21, part of the "Add Deal" backend build): `deals.service.ts`'s
  `create`/`update` (entityType `"deal"`) and the new `deal-notes.*`'s `create`/`update`
  (entityType `"deal_note"`) — built in from day one this time, not retrofitted. Verified via the
  real API: created a deal and confirmed its `insert` row; posted and edited a note and confirmed
  both its `insert` and `update` rows. Every other service still needs this same rollout, one
  table at a time, per the original scope here.

- [x] **Frontend request logging.** ✅ Done.
  Added a `[serverFetch] METHOD path status duration` line to every call through
  `serverFetch` (`frontend/src/lib/api/server-client.ts`) and a matching
  `[apiFetch] METHOD path status duration` line to `apiFetch`
  (`frontend/src/lib/api/client.ts`) — `serverFetch`'s land in the Next.js server terminal,
  `apiFetch`'s in the browser console. Also logs the 401-refresh-retry branch explicitly (attempt,
  succeeded/failed) on both, and wraps each in try/catch that logs then rethrows on a genuine
  network-level failure (previously uncaught) — matching the "Deep debug logging inside every
  backend endpoint" rule in `CLAUDE.md`, applied here on the frontend's own request layer.
  Verified live: loaded `/system/admin/departments` and confirmed `[serverFetch] GET /departments
  200 67ms` (plus `/auth/me`, `/relationship-types`, `/main-stages`, `/tenants`) in
  `docker logs orelia-frontend-1`.

- [x] **Password-confirm cascade-delete dialog.** ✅ Done.
  Added `POST /auth/verify-password` (`backend/src/modules/auth/auth.controller.ts` +
  `auth.service.ts::verifyPassword`) — reuses the exact same `bcrypt.compare` check as login,
  gated on just `JwtAuthGuard` (any logged-in user can verify their own password, no RBAC
  permission needed), never issues new tokens. Existing password redaction in
  `RequestLoggerMiddleware` picked this route up automatically (`body={"password":"[REDACTED]"}`
  confirmed in logs, no extra work needed there).
  Added a new frontend variant alongside the existing `ConfirmDialog`:
  `frontend/src/components/ui/CascadeDeleteConfirmDialog.tsx` (red-styled warning box using the
  `crm-primary`/`crm-primary-tint` tokens + a required password field) plus a new
  `useCascadeDeleteConfirm()` hook in `DialogProvider.tsx`, parallel to `useConfirm`/`useAlert` —
  see `[[project_reusable_confirm_alert_dialogs]]`. The Delete button only *unlocks* once a
  password is typed; whether it's actually correct is always checked server-side via
  `verifyPassword()` (`frontend/src/lib/api/auth.ts`) before the caller's promise resolves `true` —
  wrong password shows an inline error and keeps the dialog open, never silently proceeds.
  Verified via direct API calls (correct password → `valid: true`; wrong password → `valid:
  false`) and confirmed the debug-log trail in `docker logs orelia-backend-1`.
  Added `/auth/verify-password` to `api-endpoint-registry.md`.

- [x] **Wire the password-confirm dialog into existing cascade-delete flows.** ✅ Done — every
  resource that currently has a real, checkable dependent relationship (Relationship Types, Main
  Stages) is fixed and verified; everywhere else either has no cascade risk (`SET NULL` FKs) or
  has no dependent data possible yet (Teams → members, feature not built). Full audit below.

  **Dependent-relationship audit** (checked each FK's `onDelete` behavior + whether app code
  cascades the soft-delete today):
  - [x] **Relationship Types → tagged Companies/Contacts (`relationship_company_contact_map`).**
    ✅ Done. Real cascade (raw FK was `ON DELETE CASCADE`, but soft-deletes never fired it, so
    tagged rows were previously left orphaned on delete). Fixed in
    `relationship-types.service.ts::remove()`: now runs inside one `dataSource.transaction`,
    soft-deletes every active map row for that type (with its own `deletedBy`) before soft-deleting
    the type itself. Added `RelationshipTypeResponse.dependentCount` (one grouped COUNT query for
    the whole list, no N+1) so `RelationshipTypesWidget.tsx` knows upfront whether to show the
    plain `useConfirm` (0 dependents) or `useCascadeDeleteConfirm` (1+, with the real count in the
    warning message). Verified end-to-end via the real API: created a type, tagged a company under
    it (`dependentCount` went 0→1), deleted the type, confirmed via `psql` that **both** the type
    row and the map row got `deleted_at`/`deleted_by = admin` set, and confirmed the underlying
    Company record was left untouched (only the tagging/map row is cascaded, never the party's own
    data — it may still be relevant elsewhere).
  - [x] **Main Stages → Sub Stages (`sub_stages.main_stage_id`, raw FK is `ON DELETE CASCADE`).**
    ✅ Done. Same shape/fix as Relationship Types: `main-stages.service.ts::remove()` now runs
    inside one `dataSource.transaction`, soft-deletes every active Sub Stage under that Main Stage
    (with its own `deletedBy`) before soft-deleting the Main Stage itself. Added
    `MainStageResponse.dependentCount` (grouped COUNT, no N+1); `MainStagesWidget.tsx` shows
    `useCascadeDeleteConfirm` when it's 1+, plain `useConfirm` at 0. Verified via the real API +
    `psql`: created a stage, added a sub-stage (`dependentCount` 0→1), deleted the stage, confirmed
    both rows got `deleted_at`/`deleted_by = admin`.
  - [x] **Sub Stages / Main Stages → Deals currently in that stage.** ✅ Decided + implemented:
    **block**, not cascade or reassign. `Deal.currentStageId` is required with no `onDelete`
    action — cascading past it would leave a Deal pointing at a soft-deleted stage the Funnel
    board can't render. Both `sub-stages.service.ts::remove()` (direct single-stage delete) and
    `main-stages.service.ts::remove()` (cascade path, checked across every Sub Stage about to be
    cascaded) now count active Deals referencing the stage(s) first and throw a `ConflictException`
    ("N deal(s) are currently in it/one of its sub-stages, move them first") before anything is
    touched — deliberately thrown outside the try/catch so it isn't logged as a system error, same
    treatment as `NotFoundException` elsewhere. Verified via the real API: created a Deal sitting
    in a Sub Stage, confirmed deleting either that Sub Stage directly or its parent Main Stage
    returns 409 Conflict with the debug log showing the exact blocking count (came back `3` against
    real pre-existing seed deals plus the one just created for the test, confirming it's checking
    live data, not a stale count).
  - [x] **Teams → members (`teams_employee_map`, raw FK is `ON DELETE CASCADE` on both sides).**
    ✅ Checked, no fix needed **yet** — not because there's nothing to cascade in principle, but
    because team-membership management doesn't exist as a feature at all today: grepped every file
    under `backend/src/modules/teams/` and there is no controller, no service method, nothing
    anywhere that creates, reads, or deletes a `teams_employee_map` row. The table exists in the
    schema (from the original ERD) but nothing in the app ever populates it, so it will always be
    empty in practice right now — there's no real dependent data to cascade against. **When
    team-membership management gets built** (add/remove member endpoints), that feature must
    include this from day one, not bolt it on after: `TeamsEmployeeMap` has no `deletedAt` of its
    own (a bare join table, not a first-class soft-deletable record), so removing a membership —
    whether via its own "remove member" action or as a consequence of the team itself being
    deleted — is a genuine hard-delete of the join row, done inside the same transaction as
    whatever else is happening, never a soft-delete. Flagging this as a build-time requirement for
    that future feature rather than shipping speculative cascade code against a table nothing
    writes to yet.
  - [x] **Deal Sources → Deals referencing them.** No cascade needed —
    `Deal.sourceId` is `onDelete: SET NULL`, and deleting a Deal Source never deletes a Deal, only
    (on a real hard-delete, which never happens here) would null the reference. A plain `useConfirm`
    is correct as-is; no dialog change needed.
  - [x] **Departments → Deals referencing them.** Same reasoning as Deal Sources —
    `Deal.departmentId` is `onDelete: SET NULL`, no records get deleted. Plain `useConfirm` stays
    correct.
  - [x] **Deal Sources / Departments / Main Stages / Sub Stages → nothing else checked.** No other
    inbound FKs found pointing at these four tables besides the ones already listed above.

- [ ] **Enforce `createdBy`/`updatedBy` non-null at the DB level (stretch — do last).**
  Once confident every service path always sets these (audit via the `audit_logs` rollout above),
  change `created_by`/`updated_by` from `nullable: true` to `NOT NULL` via migration. Do this last
  and only after checking existing seed/system data — a blind constraint added now would break
  any row inserted without a real actor (e.g. system-seeded reference data).

- [x] **Consolidate picker/dropdown endpoints into one backend module.** ✅ Done.
  Moved every picker/dropdown lookup into a new `backend/src/modules/pickers/` module
  (`pickers.controller.ts` + `pickers.module.ts`), exposing `GET /pickers/departments`,
  `/pickers/companies`, `/pickers/company-countries`, `/pickers/contacts`, `/pickers/employees`,
  `/pickers/industries` — mirroring how `frontend/src/lib/pickers/server.ts` already aggregates
  every picker fetch function in one file on the frontend. Deleted the now-empty
  `companies.controller.ts`, `contacts.controller.ts`, `employees.controller.ts`,
  `industries.controller.ts` (each contained *only* a picker route); trimmed the picker route out
  of `departments.controller.ts` (kept its real CRUD). Underlying service methods
  (`findPicker`/`findCountries`/`findAll`) untouched — only the HTTP route layer moved.
  **Found and fixed 3 real pre-existing permission bugs while moving these** (not just a pure
  relocation, per the note this item used to have): `/contacts/picker` was gated on `CONTACTS_VIEW`
  (the resource's own admin permission — a direct violation of the picker rule below) even though
  its only real caller is the Deals/Funnel Add Deal dialog; `/companies/picker`, `/employees/picker`,
  and `/industries` were gated on `RELATIONSHIP_*` only, even though the Deals/Funnel pages call
  them too — a Deals-only user with no Relationship permission would have silently gotten an empty
  dropdown. Fixed by gating each consolidated route on the union of its real consumers'
  permissions. Also added deep debug logging to every one of these endpoints and their underlying
  service methods — see the new "Deep debug logging inside every backend endpoint" rule in
  `CLAUDE.md`. Verified via direct API calls (login + each of the 6 routes) and the real Funnel
  page SSR load, both confirmed 200s with correct data and full debug-log trails in
  `docker logs orelia-backend-1`.

- [ ] **Retrofit deep debug logging to every existing backend endpoint.**
  The `pickers` module above (and its underlying services) is the reference implementation for the
  new "Deep debug logging inside every backend endpoint" rule in `CLAUDE.md` — entry log with
  inputs, a debug line for every conditional branch actually taken, a result-count log on the way
  out, and the whole method body wrapped in try/catch with `logger.error` + rethrow (never
  swallow). Every endpoint built before this rule existed needs this same treatment. Roll out
  module-by-module, not all at once — same incremental discipline as everything else in this file.
  **Done so far**: Pickers, Auth (`verify-password`), Relationship Types, Main Stages/Sub Stages,
  `deals.service.ts::create/update`, and the new `deal-notes.*` (built with it from day one, per
  the "Add Deal" backend work). **Still needs it**: Departments, Deal Sources, Teams, Relationship
  Parties, RBAC, Users, Tenants, the rest of Auth, `deals.service.ts::remove/moveStage`.
