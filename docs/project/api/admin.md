# API Endpoint Registry — Admin

Part of the split registry — see [`../api-endpoint-registry.md`](../api-endpoint-registry.md) for
the sync rule and column legend shared across every file in this folder.

---

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

---

## Users (`backend/src/modules/users/users.controller.ts`)

Handles passwords and sessions — every log line and audit entry was written deliberately to never
include a plaintext password or password hash, matching the existing redaction precedent already
used by `RequestLoggerMiddleware` elsewhere in this codebase.

| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller → Service | Frontend Consumer(s) | Debug Logging | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/users` | RBAC | `USERS_VIEW` | List every user (summary shape). | none | `UserSummaryResponse[]` | `findAll` → `users.service.ts::findAll` | Users admin widget | ✅ | **2026-07-22**: added debug logging at both layers across the whole service — had none before. |
| 2 | GET | `/users/:id` | RBAC | `USERS_VIEW`/`_UPDATE` | Fetch one user's full detail. | none | `UserResponse` | `findOne` → `users.service.ts::findOneOrFail` | Edit User dialog | ✅ | **Shape change 2026-07-23 (Story 1.6):** response now includes `linkedEmployee: {id, fullName} \| null`, resolved from `employees.user_id` (the link's single source of truth). |
| 3 | POST | `/users` | RBAC | `USERS_CREATE` | Create a user (optionally assigning roles and linking an Employee HR record). The server generates the temporary password; the admin never supplies or sees it. | body: `{username, displayName, loggingEmail, status?, extras?, roleIds?, employeeId?}` | `CreateUserResponse` (= `UserResponse` + `welcomeEmail: {sent, reason?}`) | `create` → `users.service.ts::create` | Users admin widget (Add) | ✅ | Records an `audit_logs` insert — deliberately excludes the password; only `username`/`displayName`/`status`. **2026-07-23 (Story 1.6):** optional `employeeId` links the new account to an employee via `EmployeesService.linkToUser` — 409 if that employee is already linked to another account; the employee-side change gets its own `audit_logs` update (`entityType: "employee"`, `userId` diff). **Request-shape correction 2026-07-31:** this row still listed `password` and `mustChangePassword?` in the body long after commit `6b259a8` removed both from `CreateUserDto` — corrected here. **Response-shape change 2026-07-31 (see `docs/project/BUGS.md`'s provisioning findings, bug 1):** adds `welcomeEmail`. Still `201` when the mail fails — the account genuinely committed, and failing the request would misreport a committed write and invite a duplicate-username retry. `sent` means *the provider accepted the message*, not that it was delivered; SendGrid validates recipients asynchronously and this app consumes no bounce webhook. |
| 4 | PATCH | `/users/:id` | RBAC | `USERS_UPDATE` | Update a user's fields, full-replace their role set, and/or change their Employee link. | body: partial fields + `roleIds?` + `employeeId?` (tri-state: absent = unchanged, `null` = unlink, uuid = link) | `UserResponse` | `update` → `users.service.ts::update` | Edit User dialog | ✅ | Records an `audit_logs` update diff for the entity fields; `roleIds` (if present) is handled separately via `RbacService.replaceRolesForUser`, which audits against `entityType: "user"` itself. **2026-07-23 (Story 1.6):** `employeeId` handled via `EmployeesService.linkToUser`/`unlinkFromUser` (covers retroactively linking pre-existing accounts); switching employees unlinks the old one first; 409 on linking an employee already tied to a different account. DB-level guarantee: partial unique index `UQ_employees_user_id` (migration `1784700000009`). |
| 5 | GET | `/users/:id/roles` | RBAC | `USERS_VIEW`/`_UPDATE` | List a user's currently-assigned role ids. | none | `string[]` | `getRoleIds` → `rbac.service.ts::getRoleIdsForUser` | Edit User dialog | ✅ | |
| 6 | POST | `/users/:id/reset-password` | RBAC | `USERS_UPDATE` | Admin-initiated password reset (forces `mustChangePassword`). | body: `{password}` | `204 No Content` | `resetPassword` → `users.service.ts::resetPassword` | Users admin widget | ✅ | Records an `audit_logs` update with `{passwordReset: true, mustChangePassword: true}` — never the password itself. |
| 7 | POST | `/users/me/change-password` | Any authenticated user (no RBAC permission) | Self-service password change; revokes every other active session. | body: `{currentPassword, newPassword}` | `204 No Content` | `changeOwnPassword` → `users.service.ts::changeOwnPassword` | Profile page | ✅ | Records an `audit_logs` update with `{passwordSelfChanged: true}` — never a password. |
| 8 | PATCH | `/users/:id/disable` | RBAC | `USERS_DISABLE` | Disable a user and revoke all their active refresh tokens. | none | `UserResponse` | `disable` → `users.service.ts::disable` | Users admin widget | ✅ | Records an `audit_logs` status-change update. |
| 9 | PATCH | `/users/:id/enable` | RBAC | `USERS_DISABLE` | Re-enable a user. | none | `UserResponse` | `enable` → `users.service.ts::enable` | Users admin widget | ✅ | Records an `audit_logs` status-change update. |
| 10 | DELETE | `/users/:id` | RBAC | `USERS_DELETE` | Soft-delete a user. | none | `{success: true}` | `remove` → `users.service.ts::remove` | Users admin widget | ✅ | Records an `audit_logs` delete entry. **Verified live** (2026-07-22): created a real user, renamed it, reset its password, disabled, re-enabled, deleted it, via the real API — confirmed the full debug-log trail at both layers with zero password/hash leakage anywhere, and all six `audit_logs` rows. |

---

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
