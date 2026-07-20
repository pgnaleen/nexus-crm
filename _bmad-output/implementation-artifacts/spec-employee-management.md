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

**Approach:** Build full CRUD (Manage/Create/View/Update/Delete) for Employees, mirroring the existing Users Management pattern (the most complete CRUD example in this codebase) for controller/service/DTO/permission shape on the backend, and table-widget + form-dialog shape on the frontend. Confirmed scope decisions (2026-07-20):
1. v1 excludes NIC/passport number and base salary from the create/edit form — those are sensitive fields; the entity has an NIC/passport encryption flag that isn't actually implemented at the app layer yet, so exposing them needs a follow-up decision on protection (stricter permission and/or masked display) before they're editable. Fast-follow, not v1.
2. v1 includes profile photo and CV upload (fields already exist on the entity: `profilePhotoUrl`, `cvLastUpdated`/`s3Key`), reusing the existing Uploads module pattern (already used for company logos and deal documents).
3. v1 includes managing the optional Employee → User (login account) link from this screen.

## Plan

### Backend
1. `create-employee.dto.ts` / `update-employee.dto.ts` — validate all v1 fields (dates, enums for gender/employment type/employment status, etc.); exclude `nicPassportNumber`/`nicPassportEncrypted`/`baseSalary` per decision 1.
2. `EmployeesService`: `findAll`, `findOneOrFail`, `create`, `update`, `remove` — tenant-scoped via the existing `BaseTenantRepository`/`EmployeesRepository`, mirroring `UsersService`'s shape (re-fetch after `Object.assign` + save, as `UsersService.update` already does, to avoid misreporting omitted-DTO-field-as-undefined).
3. `EmployeesController`: add `GET /employees`, `GET /employees/:id`, `POST /employees`, `PATCH /employees/:id`, `DELETE /employees/:id`, plus wiring for the Employee↔User link (decision 3) — likely a `userId` field on `UpdateEmployeeDto` with a tenant-scoped existence check before saving. Existing `GET /employees/picker` stays as-is (already used elsewhere for dropdowns).
4. Contracts in `common/src/contracts`: `EmployeeResponse`, `EmployeeSummaryResponse`, `CreateEmployeeRequest`, `UpdateEmployeeRequest` — build on the existing (currently unused) `IEmployee` type in `common/src/types/employee.types.ts`.
5. Profile photo + CV upload: reuse the Uploads module (`backend/src/modules/uploads`) the same way `CompanyFormDialog`'s logo upload and deal documents already do.
6. Add 5 new permission keys to `common/src/constants/permissions.ts`: `EMPLOYEES_MANAGE`, `EMPLOYEES_VIEW`, `EMPLOYEES_CREATE`, `EMPLOYEES_UPDATE`, `EMPLOYEES_DELETE` (mirrors the `DEPARTMENT_*` 5-key pattern). No seed-file changes needed beyond this -- `seedRbacResources()` auto-registers any new `PERMISSIONS` key as an `RbacResource` on the next seed run, so these appear in the Roles admin UI automatically.
7. Gate each new endpoint with `RequirePermission`: list → `EMPLOYEES_MANAGE`; `GET /:id` → `[EMPLOYEES_VIEW, EMPLOYEES_UPDATE]`; create → `EMPLOYEES_CREATE`; update → `EMPLOYEES_UPDATE`; delete → `EMPLOYEES_DELETE` (mirrors `UsersController`'s exact permission-per-action shape).

### Frontend
1. Replace the placeholder `EmployeesWidget.tsx` with `EmployeesTableWidget.tsx` — list, search, permission-gated action buttons, following `UsersTableWidget.tsx`.
2. `EmployeeFormDialog.tsx` — create/edit. Reuse existing pieces: `PhoneField` for mobile/office numbers, `CustomSelect` for department/reporting-manager/enum fields (gender, employment type, employment status), a picker for linking a `User` account (decision 3), and the uploads flow for profile photo + CV (decision 2).
3. Wire the sidebar's existing Employees entry (`Sidebar.tsx`, "Human Resources" group) to `EMPLOYEES_VIEW`/`EMPLOYEES_MANAGE`, closing the current no-permission-gate gap.
4. `frontend/src/lib/api/employees.ts` (new) — API client functions for the new endpoints, mirroring `frontend/src/lib/api/users.ts`.

### Explicitly deferred (not v1)
- NIC/passport number and base salary fields (decision 1) -- needs a separate decision on field-level protection (e.g. a stricter permission, or masked/reveal-on-demand display) before exposing them.
- Actual encryption-at-rest for `nicPassportNumber` (the entity's `nicPassportEncrypted` flag already implies this was intended but never implemented).

## Suggested Build Order
1. Backend: DTOs + contracts + permissions constant + service + controller
2. Frontend: API client lib + `EmployeeFormDialog` (create/edit) + `EmployeesTableWidget` (list)
3. Sidebar permission gate
4. Manual test: create/edit/delete/view an employee end-to-end, including photo/CV upload and linking a User account; confirm permission gating actually blocks a role without `EMPLOYEES_*` grants
5. Commit, push, deploy (same flow as prior features this session)
