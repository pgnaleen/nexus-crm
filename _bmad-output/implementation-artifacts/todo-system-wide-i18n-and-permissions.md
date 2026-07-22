# Todo — System-Wide i18n & Permission Model Migration

Supervisor-directed changes affecting every already-built section of the app (not just Funnel).
The slice of each change that's specific to Funnel is tracked as its own task in
`_bmad-output/planning-artifacts/plan-funnel-deal-management.md` instead — this file is
everything *outside* Funnel. Standing rules for all *future* work are in `CLAUDE.md`
("Permission Model", "RBAC Routes vs. System-Internal (Picker) Routes", "Internationalization").
Each item below ships on its own — do not batch these together.

## Part A — Permission model migration (View/Create/Edit/Delete, no Manage, friendly group names) ✅ done

Completed in full: display-name mapping (A0), all real gaps found (A1: missing
`RELATIONSHIP_TYPE_VIEW` added, dead `USERS_READ` deleted, orphaned `deal_sources:manage`
plural row removed, `COMPANIES_READ`/`CONTACTS_READ`/`DEALS_READ` renamed to `_VIEW`), the three
standalone Manage-only endpoints given a real fallback permission (A2), the critical
`Sidebar.tsx` fix (was checking one hardcoded key per nav item — now checks "any permission under
this resource's prefix", so it never needs editing again for this reason), and the full
mechanical migration of all ten remaining `_MANAGE` keys (A3: verified both `Admin` and
`Super Admin` already held every granular equivalent before removal — zero access lost — then
trimmed every controller guard and frontend `hasManage` fallback, deleted the ten keys, cleaned
up the DB rows). Verified via full typecheck (zero new errors) and an end-to-end browser pass
(sidebar, every migrated section's list view, a real create+delete on Departments, and the Roles
dialog showing clean View/Create/Edit/Delete rows with no more "Manage").

`DEAL_STAGES_MANAGE` was deliberately left alone here — it's Funnel's own task (see
`plan-funnel-deal-management.md`, Task 4), not a system-wide one.

### Original migration plan (kept for reference — superseded by the "done" summary above)

This turned out to be five distinct problems, not one — grounded in an actual read of every
permission key, every controller guard, and the Roles UI's grouping code (not assumed). Do these
**in this order** — several later steps depend on earlier ones landing first.

### A0. Decide and build the resource display-name mapping (do this first)

**Finding:** the Roles UI groups permissions by literally splitting the key on `:` and using the
raw prefix as the header — `frontend/src/components/layout/RolePermissionsDialog.tsx:20-30,193-206`.
There is **no display-name mapping anywhere**, backend or frontend, and `rbac_resources` has no
`group`/`category` column (`name` — the raw key — is the only field). So today's Roles UI shows
literal, un-cased headers: `deals`, `main_stage`, `sub_stage`, `deal_source`, `relationship_type`,
etc. — not "Deals"/"Main Stage"/etc., and definitely not "Funnel."

- [ ] Add a `PREFIX_DISPLAY_NAME` map in the frontend (simplest option — no schema change) that
  `groupByPrefix`'s render step consults instead of the raw prefix string. Cover every prefix,
  since this is the same mechanism for all of them:
  `deals` → **"Funnel"** (matches how you refer to this feature everywhere else in the product —
  this is the concrete answer to "add an id for Funnel": there's no separate resource to create,
  the existing `deals:*` permission group just needs to *display* as "Funnel" instead of the raw
  string), `main_stage` → "Main Stages", `sub_stage` → "Sub Stages", `deal_source` → "Deal
  Sources", `relationship_type` → "Relationship Types", `relationship` → "Relationships",
  `rbac` → "Roles", `tenants` → "Tenants", `users` → "Users", `teams` → "Teams",
  `department` → "Departments", `companies` → "Companies", `contacts` → "Contacts".
- [ ] Also give per-action row labels a real name instead of the raw suffix (e.g.
  `deals:stage:update` currently renders as literal `stage:update` — should read something like
  "Move Stage").

### A1. Fix real gaps found during this audit (independent of the Manage removal)

- [ ] **`relationship_type` has no view/read permission at all** — only create/update/delete/manage
  exist. Add `RELATIONSHIP_TYPE_VIEW` (`relationship_type:view`) before migrating this resource
  off Manage, or there will be nothing to fall back to for read access.
- [ ] **`USERS_READ` (`users:read`) is dead** — grepping every controller shows only `USERS_VIEW`
  is ever referenced; `USERS_READ` is an unused duplicate. Delete it (separately from the Manage
  work, it's unrelated dead code).
- [ ] **Orphaned resource row: `deal_sources:manage`** (plural) is assigned to both Admin and
  Super Admin in the database, but **does not exist in `permissions.ts` at all** — only the
  singular `deal_source:manage` does. This is leftover from a past rename that never cleaned up
  the old resource row/role-assignment. Unassign it from both roles and delete the orphaned
  `rbac_resources` row — nothing to migrate it *to*, since no current key matches it.
- [ ] **Normalize `view` vs `read` naming.** `companies`, `contacts`, and `deals` use `_READ`;
  every other resource uses `_VIEW`. Since the supervisor's stated model is "View, Create, Edit,
  Delete," rename `COMPANIES_READ`→`COMPANIES_VIEW`, `CONTACTS_READ`→`CONTACTS_VIEW`,
  `DEALS_READ`→`DEALS_VIEW` (update every backend reference, not just the constant, then re-seed).

### A2. Resources with genuinely no fallback permission today (need a real decision, not just a rename)

Some endpoints are gated **only** by a `_MANAGE` key with no OR'd specific-action fallback at all
— migrating these means deciding which of View/Create/Update/Delete each endpoint actually is,
not just adding four permissions and moving on:

- [ ] `RBAC_MANAGE` alone gates two endpoints in `rbac.controller.ts` (lines 18, 26) — read each
  handler and assign the correct specific permission(s).
- [ ] `TENANTS_MANAGE` alone gates three endpoints in `tenants.controller.ts` (lines 40, 48, 56).
- [ ] `USERS_MANAGE` alone gates the user-list endpoint in `users.controller.ts` (line 26).

### A3. The `_MANAGE`-with-fallback resources (the more mechanical part)

**Current real state** (queried directly from `rbac_role_resource_map`): only **Admin** and
**Super Admin** hold any `_MANAGE` permission —

- **Admin**: `deal_source:manage`, `deal_stages:manage`, `main_stage:manage`, `rbac:manage`,
  `relationship:manage`, `relationship_type:manage`, `teams:manage`, `users:manage`
- **Super Admin**: all of the above, plus `department:manage`, `sub_stage:manage`,
  `tenants:manage`

- [ ] For each resource above (except `deal_stages`, which is Funnel's Task 4 — a pure deletion,
  no fallback exists or is needed), grant the holding role(s) the equivalent
  `_VIEW`+`_CREATE`+`_UPDATE`+`_DELETE` permissions **before** removing the `_MANAGE` grant, in
  the same change — no role may lose access at any point.
- [ ] Trim every `@RequirePermission([..., PERMISSIONS.X_MANAGE])` array across the ~11 affected
  controller files (`departments`, `main-stages`, `sub-stages`, `deal-sources`,
  `relationship-types`, `relationship-parties`, `tenants`, `users`, `rbac`, `teams`, plus the two
  from A2) to drop the `_MANAGE` reference once its replacement is confirmed working.
- [ ] Delete the `_MANAGE` keys from `common/src/constants/permissions.ts` and their
  `rbac_resources` rows — only after the above lands and is verified. TypeScript will fail to
  build if any controller still references a deleted key — treat that compile error as the real
  completeness check, not the grep done during planning.
- [ ] Check `RolePermissionsDialog` for any "select all" convenience that currently just toggles
  a `_MANAGE` checkbox — it needs to instead toggle all four granular permissions together once
  the single wildcard key doesn't exist.

### A4. Verification

- [ ] Confirm Admin's and Super Admin's effective access is unchanged before/after, resource by
  resource, in the Roles UI.
- [ ] Confirm the Roles UI now shows friendly group names (including "Funnel" for the `deals`
  group) instead of raw prefixes.

## Part B — Internationalization rollout for existing sections

Every section built before this rule existed hardcodes its own UI strings. Retrofit one section
at a time, verified in the browser after each (language switch — even with only the English file
existing — must render identically to today, since the fallback/default language is English).

- [ ] **Tenants, Roles, Users, Teams** (System Administration group)
- [ ] **Relationship Types, Deal Sources, Main Stages, Sub Stages, Departments** (CRM
  Configuration group)
- [ ] **Relationships** (dynamic per-relationship-type pages, `CompanyFormDialog`/
  `ContactFormDialog`)
- [ ] **Employee Management** (per the existing spec at
  `_bmad-output/implementation-artifacts/spec-employee-management.md`, if not yet built by the
  time this is picked up — build it i18n-ready from the start rather than retrofitting immediately
  after)
- [ ] **Shared UI primitives' own built-in text** — `Button`, `Dialog`, `ConfirmDialog`/
  `AlertDialog` (`DialogProvider`), `SearchSelect`/`MultiSelect`/`CustomSelect` placeholder
  defaults, toast messages (`ToastProvider`) — anything a shared component renders itself (not
  passed in as a prop) needs its own default-label lookup too, not just the pages that use them.

Decide and stand up the actual i18n mechanism (library choice, where language files live, how
the active language is selected/persisted, server-vs-client rendering implications for Next.js
App Router) as its own first step here — don't let the first section's retrofit accidentally
become the de-facto architecture decision without it being deliberate.
