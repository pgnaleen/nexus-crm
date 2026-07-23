# Story 1.4: Update Employee Record

Status: ready-for-dev

## Story

As an **HR admin with edit access**,
I want **to edit an existing employee's details, using the same tabbed layout as creation**,
so that **I can keep their record accurate as things change — a promotion, updated contact info — without re-entering everything from scratch**.

## Acceptance Criteria

> Permission naming note: the epic text says `EMPLOYEES_UPDATE` / `EMPLOYEES_MANAGE_SENSITIVE`. The codebase's actual sensitive-gate key is **`EMPLOYEES_VIEW_SENSITIVE`** (`employees:view_sensitive`) — deliberately renamed to honor the project's "no `_MANAGE` key" rule (see `common/src/constants/permissions.ts:78-86`). `EMPLOYEES_UPDATE` (`employees:update`) does not exist yet and is **created by this story**.

1. **AC1 — Pre-filled edit form.** Given I have `EMPLOYEES_UPDATE` and open an employee's edit form, the form loads pre-filled with their current Personal, Employment, and Contact tab data (same tabbed dialog as create, Story 1.2).
2. **AC2 — Confidential tab gating.** With `EMPLOYEES_VIEW_SENSITIVE` the Confidential tab is present and pre-filled (NIC/passport, base salary); without it, the tab does not exist in the UI at all — same as create/view.
3. **AC3 — Department change propagates.** Changing department and saving is reflected immediately in the Employee Directory list. **Reporting manager is NOT editable here** — that relationship is set exclusively via the Organization Chart (Story 1.8); the edit form must not add any reporting-manager field.
4. **AC4 — Sensitive data can't be wiped blind.** With `EMPLOYEES_UPDATE` but *not* `EMPLOYEES_VIEW_SENSITIVE`, submitting an edit to non-sensitive fields leaves existing NIC/salary values completely untouched — my edit can't wipe data I can't see.
5. **AC5 — Clearing optional fields works.** Clearing a previously-set optional field (e.g. bio) and saving actually clears it in the record (NULL in DB), not silently ignored.
6. **AC6 — File replacement, not orphaning.** Uploading a new profile photo or CV over an existing one replaces it: the old file is removed from disk (not just orphaned in `uploads/`), and the new one displays immediately.
7. **AC7 — Permission-gated UI.** Without `EMPLOYEES_UPDATE`, no edit affordance appears anywhere (directory or detail dialog). The backend endpoint independently rejects a caller without the permission (frontend checks are UX only).

## Tasks / Subtasks

- [ ] Task 1 — Permission key (AC: 7)
  - [ ] Add `EMPLOYEES_UPDATE: "employees:update"` to `common/src/constants/permissions.ts` (below `EMPLOYEES_CREATE`; trim the "UPDATE/DELETE are added alongside their own stories" comment to now only reference DELETE)
  - [ ] Seed picks it up automatically — `seedRbacResources()` iterates `Object.values(PERMISSIONS)` (`backend/src/database/seeds/seed.ts:91-100`) and the Super Admin grant loop grants every resource. Re-run `docker compose exec backend pnpm --filter @orelia/backend seed` (idempotent) after the code lands
- [ ] Task 2 — Shared contract (AC: 1, 4, 5)
  - [ ] Add `UpdateEmployeeRequest` to `common/src/contracts/employees.contracts.ts`: every `CreateEmployeeRequest` field, all optional, with **`| null` on every optional field** — `undefined`/absent = leave unchanged, `null` = clear, value = set. `fullName?: string` (no null — it's required-nonempty when present). Document the tri-state semantics in the contract comment
  - [ ] Rebuild common in Docker after editing: `docker compose exec backend pnpm --filter @orelia/common build` (it is NOT watched — stale-build symptom is a TS2305 "no exported member" error in backend/frontend)
- [ ] Task 3 — Backend endpoint (AC: 1, 3, 4, 5, 7)
  - [ ] `backend/src/modules/employees/dto/update-employee.dto.ts`: `UpdateEmployeeDto implements UpdateEmployeeRequest` — mirror `create-employee.dto.ts` validators but `@IsOptional()` on everything including `fullName` (keep its `@MinLength(1)`/`@MaxLength(200)` for when it IS sent). `@IsOptional()` skips validation for both `undefined` and `null`, so `field?: string | null` works as-is
  - [ ] `employees.service.ts`: add `findOneBareOrFail(id)` — private, `findOneScoped({ where: { id } })` with **zero relations** — and `update(id, dto, userId)` following `deals.service.ts::update` (lines 183-231) exactly: bare load → capture `before` for keys in dto → `Object.assign(employee, dto, { updatedBy: userId })` → map `cvUrl` dto key onto the entity's `s3Key` column (same rename `create()` does at line 84-88) → `saveScoped` → re-fetch via existing `findOneOrFail` (relations) for the response → field-diff `auditLogService.record({ entityType: "employee", action: "update", ... })` with only actually-changed fields
  - [ ] File cleanup for AC6: after a successful save where `profilePhotoUrl` or `s3Key` changed away from a previous value, delete the old file (see Task 5)
  - [ ] `employees.controller.ts`: `@Patch(":id")` gated `@RequirePermission([PERMISSIONS.EMPLOYEES_UPDATE])`, returns `EmployeeDetailResponse` via the existing `toDetailResponse(employee, hasSensitiveAccess)`. **Sensitive stripping: `delete dto.nicPassportNumber; delete dto.baseSalary` when `!hasSensitiveAccess`** — must be `delete`, not `= undefined` assignment, so the keys vanish from `Object.keys(dto)` and the service's assign/diff loops never touch those columns (AC4). Reuse the existing `hasSensitiveAccess()` helper
  - [ ] Deep debug logging + try/catch-rethrow at BOTH controller and service layers (project rule; every existing employees method already models this)
- [ ] Task 4 — Uploads gate broadening (AC: 6)
  - [ ] `uploads.controller.ts`: change `POST /uploads/employee-photo` and `POST /uploads/employee-cv` gates from `[EMPLOYEES_CREATE]` to `[EMPLOYEES_CREATE, EMPLOYEES_UPDATE]` — the controller's own comment (lines 82-84) already schedules exactly this for Story 1.4. Update both endpoints' rows in the API registry
- [ ] Task 5 — Old-file deletion helper (AC: 6)
  - [ ] Add a small exported helper in the uploads module (e.g. `uploads.service.ts` or a util): `deleteUploadedFile(url: string)` — accepts only urls matching `/uploads/employee-photos/...` or `/uploads/employee-cvs/...` (reject anything else — no path traversal, never delete outside those two subdirs), resolves against `process.cwd() + UPLOAD_DIR`, `fs.promises.unlink`. A missing/failed unlink logs a warning and returns — file cleanup must NEVER fail the employee update (same "best-effort side effect" posture as audit-log writes)
  - [ ] Call it from `employees.service.ts::update` after successful save, for each of photo/CV whose value changed from a non-empty old value
- [ ] Task 6 — Frontend API + form dialog (AC: 1, 2, 5)
  - [ ] `frontend/src/lib/api/employees.ts`: `updateEmployee(id, payload: UpdateEmployeeRequest): Promise<EmployeeDetailResponse>` — `apiFetch` PATCH, same shape as `departments.ts:20-26`
  - [ ] `EmployeeFormDialog.tsx`: add edit mode via optional prop `initialDetail?: EmployeeDetailResponse` (present = edit, absent = create). Pre-fill `FormState` from it (map `null` → `""`); title `t("employees.dialog.editTitle")`; submit calls `updateEmployee` sending **every editable field, with `trim() || null`** (null = clear, satisfying AC5 — note this differs from create's `|| undefined`), confidential fields included only when `canViewSensitive` (omit the keys entirely otherwise — AC4)
  - [ ] Existing validation flow (jump to the tab holding the error) already works — keep it; `fullName` stays required in edit
- [ ] Task 7 — Frontend entry point + list refresh (AC: 3, 7)
  - [ ] `EmployeeDetailDialog.tsx`: add an "Edit" footer button, rendered only when a new `canUpdate` prop is true; clicking it closes detail and opens the form dialog in edit mode (lift state to `EmployeesWidget`)
  - [ ] `EmployeesWidget.tsx`: `canUpdate = permissions.includes(PERMISSIONS.EMPLOYEES_UPDATE)`; on edit-save, **replace** the row in `employees` state (match by id, keep `fullName` sort) so name/title/department/status changes show immediately (AC3). Note `handleSaved` currently only appends — add a separate `handleUpdated(detail: EmployeeDetailResponse)` mapping detail → list-item shape
- [ ] Task 8 — i18n (project rule: zero hardcoded user-facing strings)
  - [ ] `frontend/src/locales/en.json`: add `employees.dialog.editTitle`, `employees.detail.editButton` (or similar), and any new error keys. Follow the existing `employees.dialog.*` structure
- [ ] Task 9 — API Endpoint Registry (project rule: same-change update)
  - [ ] `_bmad-output/implementation-artifacts/api-endpoint-registry.md` Employees section: add `PATCH /employees/:id` row (RBAC, `EMPLOYEES_UPDATE`, request `UpdateEmployeeRequest`, response `EmployeeDetailResponse`, consumer `EmployeeFormDialog.tsx`, debug-logging ✅); amend the two uploads rows' permission column
- [ ] Task 10 — Verification (no test infra exists yet — see Dev Notes)
  - [ ] `docker compose exec backend sh -c "cd /app/backend && pnpm exec tsc --noEmit"` and `docker compose exec frontend sh -c "cd /app/frontend && pnpm exec tsc --noEmit"` — no NEW errors (pre-existing frontend errors exist in AddDealDialog/RolePermissionsDialog/UserFormDialog/RoleCardPicker — not yours, don't fix, don't add to them)
  - [ ] Manual AC walkthrough (each AC above) as Super Admin (`system`/`admin`/`ChangeMe123!`), plus a role holding `EMPLOYEES_UPDATE` without `EMPLOYEES_VIEW_SENSITIVE` for AC2/AC4 — verify NIC/salary survive in DB: `docker compose exec postgres psql -U orelia -d orelia -c "SELECT nic_passport_number, base_salary FROM employees WHERE id='...'"`
  - [ ] AC6: confirm old photo/CV file physically gone from `backend`'s `uploads/employee-photos/` (or `-cvs/`) after replacement, new file present

## Dev Notes

### ⚠️ Guardrail 1 — TypeORM: NEVER save an entity loaded with relations (project-critical)

`employees.service.ts::findOneOrFail` loads `relations: ["department", "user"]` (line 54-57). Passing that object to `saveScoped()` **silently NULLs every relation-backed FK on the row** (`department_id`, `user_id`, `reporting_manager_id`) — this exact bug corrupted Deals and is documented at length in `CLAUDE.md` ("TypeORM Gotcha"). `employees` has NO CHECK constraint to make the corruption loud — it would be **silent data loss**, including wiping `reportingManagerId`, which would corrupt the future Org Chart. Follow the split-method pattern from `deals.service.ts`: `findOneOrFail` (relations, response-building) + private `findOneBareOrFail` (bare, mutation target). Never one method for both.

### Guardrail 2 — Update semantics (tri-state)

| Payload state | Meaning | Mechanism |
|---|---|---|
| key absent (`undefined`) | leave column unchanged | `Object.assign` copies `undefined` → TypeORM ignores undefined columns on save; stripped sensitive keys are `delete`d so they're absent from `Object.keys(dto)` diff loops |
| key `null` | clear column (AC5) | TypeORM writes NULL |
| key has value | set column | normal |

Frontend edit-submit sends all visible fields with `trim() || null`. The deals `update()` comment at `deals.service.ts:201-204` explains why you must **re-fetch for the response** instead of returning the in-memory object.

### Guardrail 3 — Sensitive stripping must use `delete`

Create's controller strips with `dto.field = undefined` (fine for insert). For update, an own-property `undefined` would still appear in `Object.keys(dto)` and pollute the audit before/diff loops. Use `delete dto.nicPassportNumber` / `delete dto.baseSalary`. Server-side stripping is the real boundary (AC4) — the frontend omitting the keys is just courtesy.

### Guardrail 4 — `cvUrl` ⇄ `s3Key` rename

The API field is `cvUrl`; the entity column is `s3Key` (`employee.entity.ts:84-85`; `create()` destructures it at `employees.service.ts:84-88`; `toDetailResponse` maps back at `employees.controller.ts:124`). The update path must do the same both directions or CV updates silently no-op.

### Guardrail 5 — `baseSalary` is a Postgres `numeric` → TypeORM returns it as a **string**

The entity types it `number` (`employee.entity.ts:87-88`) but a loaded entity actually holds `"5000.00"` (string). Two consequences: (a) the audit before/after diff would log a spurious `{ old: "5000.00", new: 5000 }` change on every update that includes the field — compare with `Number(old) !== Number(new)` (or `String()==String()`) for this field, or normalize before diffing; (b) `toDetailResponse` already passes it through untouched, so the frontend must keep treating it as `string | number` when pre-filling (`String(value ?? "")`).

### Guardrail 6 — Do NOT touch

- `reportingManagerId` — not in the DTO, not in the form (AC3 / Story 1.8's exclusive domain)
- `userId` / linked user — Story 1.6's exclusive domain (read-only display already exists)
- `nicPassportEncrypted`, `dateOfExit`, `employmentStatus`-exit flows — Story 1.5
- Existing create/view behavior — regression risk is highest in `EmployeeFormDialog` (shared component); create mode must behave byte-identically after the refactor

### Architecture compliance checklist (from CLAUDE.md — all mandatory)

- `updatedBy` set from authenticated user on every update (never null on a real write)
- `auditLogService.record()` field-diff on update; its failure never fails the operation (only exception to always-rethrow)
- NestJS `Logger` per class; entry/branch/result debug lines; try/catch + rethrow at controller AND service layers
- No new `_MANAGE` permission; RBAC route (not picker) — gate on the resource's own `EMPLOYEES_UPDATE`
- i18n keys for every new user-facing string
- API registry updated in the same change

### Testing standards

**This repo has no automated test infrastructure yet** — zero `*.spec.ts`, no `test` script in `backend/package.json` (formal test rollout is tracked separately in `_bmad-output/testing/TESTING-PLAYBOOK.md`, Step 0 not started). Stories 1.1–1.3 shipped with typecheck + manual AC verification; do the same here (Task 10). Do not bolt a test framework onto this story.

### Runtime environment

Everything runs in Docker (`docker compose up -d`): backend :3001 (NestJS `--watch`, hot-reloads), frontend :3000 (Next.js dev), postgres :5432. `@orelia/common` is NOT watched — rebuild manually after contract changes (Task 2). Login: tenant `system` / `admin` / `ChangeMe123!`. Backend logs: `docker compose logs -f backend`.

### Previous story intelligence (1.1–1.3, from code + commit 22f7c54)

- Sensitive-field enforcement lives in the **controller** (strip on write, null on read) — service stays permission-unaware; keep that split
- `NotFoundException` is logged as expected-outcome (no error-level log) but still rethrown — copy `findOneOrFail`'s catch shape
- Labels for enums live in `employeeLabels.ts`; `withNotSet()` prepends the empty option; form field pattern is `TextField`/`CustomSelect`/`PhoneField`
- `EmployeeListItemResponse` deliberately excludes confidential fields — never widen it (contract file's own comment)
- Recent repo-wide conventions from latest commits: `CountrySelect` exists now (`frontend/src/components/ui/CountrySelect.tsx`) — `baseCountry` is currently a plain `TextField`; switching it to `CountrySelect` is OPTIONAL polish, only if trivial, since Story 1.2 shipped it as text

### Project Structure Notes

- New files: `backend/src/modules/employees/dto/update-employee.dto.ts` only. Everything else is edits to existing files listed in Tasks
- No DB migration needed — no schema change (all columns already exist)
- Module wiring: `EmployeesModule` already imports `RbacModule` (controller uses `RbacService`) and `CoreModule` is global (audit log) — no module changes expected; if the uploads helper lands as a new injectable, wire it in `UploadsModule` exports + `EmployeesModule` imports

### References

- Epic source: `_bmad-output/planning-artifacts/epics-hr.md` § Story 1.4 (CONFIRMED)
- Update pattern to copy: `backend/src/modules/deals/deals.service.ts:183-231`
- TypeORM gotcha: `CLAUDE.md` § "TypeORM Gotcha: never save() an entity that was loaded with relations"
- Permission rules: `CLAUDE.md` § "Permission Model" + `common/src/constants/permissions.ts:78-86`
- Uploads gate TODO honored by this story: `backend/src/modules/uploads/uploads.controller.ts:82-84`
- Registry: `_bmad-output/implementation-artifacts/api-endpoint-registry.md` § Employees

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
