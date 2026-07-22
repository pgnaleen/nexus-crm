---
title: 'Employee Management (full CRUD)'
type: 'feature'
created: '2026-07-20'
status: 'planned'
route: 'one-shot'
review_loop_iteration: 0
context: []
---

# Employee Management

## Intent

**Problem:** The `Employee` entity already models a full internal-staff HR record (~25 fields — code, name, title, department, reporting manager, employment type/status, dates, contact info, NIC/passport, CV/photo storage, base salary, optional linked login `User`), but nothing consumes it beyond a bare `GET /employees/picker` (id + name, used only as a dropdown elsewhere). The `/employees` page in the frontend is a static placeholder: the search box and "Add Employee" button do nothing, and it always renders "No employees found." The sidebar link to it also has no permission gate today, unlike every other admin-area entry.

**Approach:** Build full CRUD (Create/View/Update/Delete) for Employees, mirroring the existing Users Management pattern (the most complete CRUD example in this codebase) for controller/service/DTO/permission shape on the backend, and table-widget + form-dialog shape on the frontend. Confirmed scope decisions (2026-07-20):
1. **Revised 2026-07-20 (was: excluded from v1):** NIC/passport number and base salary ARE included in v1, but gated behind a new, narrower permission — `EMPLOYEES_MANAGE_SENSITIVE` — separate from the general `EMPLOYEES_VIEW`/`EMPLOYEES_UPDATE` grants, so only specifically-authorized roles (e.g. senior HR/Finance) can see or edit them. This does **not** solve the underlying gap that `nicPassportNumber` has no encryption-at-rest implemented yet (the entity's `nicPassportEncrypted` flag was never wired up) — that remains a separate, deferred security task. Client explicitly confirmed accepting this tradeoff rather than blocking the whole feature on building encryption first.
2. v1 includes profile photo and CV upload (fields already exist on the entity: `profilePhotoUrl`, `cvLastUpdated`/`s3Key`), reusing the existing Uploads module pattern (already used for company logos and deal documents).
3. **Revised 2026-07-20 (was: managed from Employee Management):** the optional Employee → User (login account) link is created/changed from **User Management** (Story 1.6 of the HR epic), not from Employee Management. Matches the real workflow: HR creates the employee record first; a login account only gets created later, separately, by an admin, when access is actually needed. Employee Management shows the link read-only.
4. The create/edit form is organized as tabs, mirroring the pattern already used in `CompanyFormDialog`/`ContactFormDialog`: **Personal** (full name, DOB, gender, nationality, bio, profile photo), **Employment** (employee code, title, designation, department, employment type, status, date of joined, primary location, base country, clearance level, CV upload), **Contact** (email, mobile no, office no), **Confidential** (NIC/passport number, base salary — this whole tab is only rendered at all for users holding `EMPLOYEES_MANAGE_SENSITIVE`, not just disabled/hidden fields within a visible tab, so its existence isn't revealed to unauthorized viewers).
5. **Revised 2026-07-20:** `reportingManagerId` is deliberately **not** exposed on `CreateEmployeeDto`/`UpdateEmployeeDto` at all -- to avoid two conflicting places that can set the same relationship, it's exclusively read/written by the Organization Chart feature's save endpoint (see the HR epic's Story 1.8), never through the Employee CRUD form. Every new employee starts with no manager set, appearing "unplaced" until someone places them on the chart.

## Plan

### Backend
1. `create-employee.dto.ts` / `update-employee.dto.ts` — validate all v1 fields (dates, enums for gender/employment type/employment status, etc.); exclude `nicPassportNumber`/`nicPassportEncrypted`/`baseSalary` per decision 1.
2. `EmployeesService`: `findAll`, `findOneOrFail`, `create`, `update`, `remove` — tenant-scoped via the existing `BaseTenantRepository`/`EmployeesRepository`, mirroring `UsersService`'s shape (re-fetch after `Object.assign` + save, as `UsersService.update` already does, to avoid misreporting omitted-DTO-field-as-undefined).
3. `EmployeesController`: add `GET /employees`, `GET /employees/:id`, `POST /employees`, `PATCH /employees/:id`, `DELETE /employees/:id` (soft-remove) plus a `PATCH /employees/:id/exit` (or similar) action for Story 1.5's "mark as exited" (sets `employmentStatus` + `dateOfExit`, distinct from delete). Existing `GET /employees/picker` stays as-is, and gains use as the Employee-selector source for User Management's create/edit flow (decision 3 -- the Employee↔User link itself now lives on the Users module's DTOs, not here; see Story 1.6).
4. Contracts in `common/src/contracts`: `EmployeeResponse`, `EmployeeSummaryResponse`, `CreateEmployeeRequest`, `UpdateEmployeeRequest` — build on the existing (currently unused) `IEmployee` type in `common/src/types/employee.types.ts`.
5. Profile photo + CV upload: reuse the Uploads module (`backend/src/modules/uploads`) the same way `CompanyFormDialog`'s logo upload and deal documents already do.
6. Add 5 new permission keys to `common/src/constants/permissions.ts`: `EMPLOYEES_VIEW`, `EMPLOYEES_CREATE`, `EMPLOYEES_UPDATE`, `EMPLOYEES_DELETE`, `EMPLOYEES_MANAGE_SENSITIVE` -- no `EMPLOYEES_MANAGE` (confirmed 2026-07-20: this codebase's Employees permission set doesn't need a separate "manage" super-permission the way Users does; `VIEW` alone gates the list/detail reads). No seed-file changes needed beyond this -- `seedRbacResources()` auto-registers any new `PERMISSIONS` key as an `RbacResource` on the next seed run, so these appear in the Roles admin UI automatically.
7. Gate each new endpoint with `RequirePermission`: list and `GET /:id` → `EMPLOYEES_VIEW`; create → `EMPLOYEES_CREATE`; update → `EMPLOYEES_UPDATE`; delete → `EMPLOYEES_DELETE`. `EMPLOYEES_MANAGE_SENSITIVE` isn't a route-level guard on its own -- it's checked at the field/response-shaping level: `nicPassportNumber`/`baseSalary` are stripped from `EmployeeResponse` (and rejected from `UpdateEmployeeDto` processing) unless the caller also holds it, same GET/PATCH endpoints either way.

### Frontend
1. Replace the placeholder `EmployeesWidget.tsx` with `EmployeesTableWidget.tsx` — list, search, permission-gated action buttons, following `UsersTableWidget.tsx`.
2. `EmployeeFormDialog.tsx` — create/edit. Reuse existing pieces: `PhoneField` for mobile/office numbers, `CustomSelect` for department/reporting-manager/enum fields (gender, employment type, employment status), a picker for linking a `User` account (decision 3), and the uploads flow for profile photo + CV (decision 2).
3. Wire the sidebar's existing Employees entry (`Sidebar.tsx`, "Human Resources" group) to `EMPLOYEES_VIEW`, closing the current no-permission-gate gap.
4. `frontend/src/lib/api/employees.ts` (new) — API client functions for the new endpoints, mirroring `frontend/src/lib/api/users.ts`.

### Explicitly deferred (not v1)
- Actual encryption-at-rest for `nicPassportNumber` (the entity's `nicPassportEncrypted` flag already implies this was intended but never implemented). NIC/salary ship in v1 gated by `EMPLOYEES_MANAGE_SENSITIVE`, but the underlying storage is still plain text -- this is the residual risk the client explicitly accepted on 2026-07-20.

## Suggested Build Order
1. Backend: DTOs + contracts + permissions constant + service + controller
2. Frontend: API client lib + `EmployeeFormDialog` (create/edit) + `EmployeesTableWidget` (list)
3. Sidebar permission gate
4. Manual test: create/edit/delete/view an employee end-to-end, including photo/CV upload and linking a User account; confirm permission gating actually blocks a role without `EMPLOYEES_*` grants
5. Commit, push, deploy (same flow as prior features this session)
