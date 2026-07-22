# ORELIA CRM — Project Rules

## Design System (FlyonUI)

### Status

**Tailwind CSS v4 + FlyonUI 2.4.1 are installed** (`frontend/package.json` devDependencies;
`frontend/postcss.config.js` registers `@tailwindcss/postcss`). Registered in
`frontend/src/app/globals.css` via `@import "tailwindcss/theme.css"` +
`@import "tailwindcss/utilities.css"` + `@plugin "flyonui"` — **Preflight is deliberately
excluded** (no `@import "tailwindcss/preflight.css"` / no plain `@import "tailwindcss"`), so
Tailwind's base-element reset never touches the existing hand-written CSS. Verified via a full
`next build` + visual regression pass across login, dashboard, funnel board, Add Deal dialog, and
an admin section (Users) — zero visual change, zero console/build errors from the CSS pipeline.

The frontend's existing screens (`frontend/src/app/globals.css`'s `.field`/`.dialog-tab`/etc.
classes, `Button`/`TextField`/`Dialog`/`SearchSelect` components) are still 100% hand-written CSS
and are **not yet migrated** — only new UI built from here on should use Tailwind/FlyonUI
utility classes. Existing screens get their own restyle pass later, phase by phase below.
`flyonui/variants.css`, mentioned in FlyonUI's own README, does not exist in the installed
2.4.1 package (confirmed by searching `node_modules`) — omitted from the CSS import, not a bug.

### Color tokens

Registered in `globals.css` inside a Tailwind `@theme` block (not plain `:root` custom
properties) — Tailwind v4 only generates color utilities (`bg-crm-primary`, `text-crm-shell`,
etc.) for `--color-*` names declared inside `@theme`, so the token names below carry a
`--color-` prefix beyond what the original FlyonUI guide's `:root` snippet showed. They're still
real CSS custom properties too (Tailwind exposes every `@theme` value at `:root` automatically).

| Token | Hex | Usage |
|---|---|---|
| `--color-crm-primary` | `#E91C2D` | Primary action buttons, active sidebar item, key badges/status indicators, form focus rings |
| `--color-crm-primary-hover` | `#C4101F` | Hover / pressed state for primary actions |
| `--color-crm-primary-tint` | `#FDECED` | Alert backgrounds, row highlights (light tint of primary) |
| `--color-crm-shell` | `#022B5D` | Sidebar, header, app shell background |
| `--color-crm-bg` | `#F8FAFC` | Page and card background |
| `--color-crm-text` | `#0F172A` | Body copy and headings |

**Rule:** the primary red (`#E91C2D`) must stay confined to primary action buttons, the active
sidebar menu item, key badges/status indicators, and form focus rings. Never use it as a large
solid surface fill. If it starts showing up elsewhere, replace it with the navy shell color or a
neutral grey.

### Migration discipline

- One phase per session/turn. Verify the result (visually, in the browser) before moving to the
  next phase — never batch multiple phases into one pass.
- Restyling must never touch: API calls, routes, validation logic, submit handlers, state
  management, or data mapping/sorting/filtering logic. Only className/CSS changes are in scope
  for any styling phase.
- After each phase: list every file modified, and get explicit sign-off before starting the next
  phase.

#### Phase order (do not skip ahead)

1. ✅ Setup check — confirmed: Next.js 14 App Router, no prior Tailwind, styles in
   `frontend/src/app/globals.css`, imported once from `frontend/src/app/layout.tsx`.
2. ✅ Install Tailwind + FlyonUI; configure the main CSS file. Preflight excluded, verified via
   full `next build` + visual regression across login/dashboard/funnel/Add-Deal-dialog/an admin
   section — no breakage.
3. ✅ Add the color tokens above (as a Tailwind `@theme` block — see note above).
4. Phase 1 — app shell only (sidebar, top nav, main content wrapper, page background). **Not
   started** — do this only when actually restyling the existing shell; building new
   Funnel/Deal-Management screens with Tailwind/FlyonUI classes does not require this phase
   first.
5. Phase 2 — dashboard cards (KPI/metric cards, activity cards, quick actions, empty
   states/skeletons).
6. Phase 3 — tables and lists (data tables, search bars, filter dropdowns, status badges,
   pagination, row hover states, empty states).
7. Phase 4 — forms (text inputs, selects, textareas, checkboxes/radios, validation error
   styling, save/cancel buttons).
8. Phase 5 — modals and interactive components (modals, confirmation dialogs, toasts/alerts,
   dropdown menus, tabs, drawers).
9. Phase 6 — responsive QA pass (mobile/tablet sidebar collapse, sticky top bar, card stacking,
   horizontally scrollable tables, usable forms on mobile, no overflow).
10. Final QA verification — confirm color usage, component classes, and that no logic (API
    calls, routes, validation, state) was altered anywhere in the migration.

Source: FlyonUI CRM Styling Guide (official FlyonUI documentation — themes, config, utilities,
colours, component customisation, theme controller).

## Audit, Deletion & Logging Rules

These apply to every table, service, and API call added from now on — not just new features.
One-time setup work needed to make these rules fully true (e.g. adding `deletedBy`, creating the
`audit_logs` table) is tracked separately in
`_bmad-output/implementation-artifacts/todo-audit-infrastructure.md`, not here. This section is
the standing rule; that file is the one-time build list.

### Audit columns on every table

Every table extends `AuditedEntity` (platform-level) or `AuditedTenantEntity` (tenant-scoped),
never a bare entity with its own ad-hoc columns. That gives every table, automatically:

- `createdAt`, `createdBy`
- `updatedAt`, `updatedBy`
- `deletedAt`, `deletedBy` (soft-delete — `deletedAt IS NULL` means active; no separate boolean
  `deleted` column, since that would just be a second flag that can drift out of sync with
  `deletedAt`)

**Rule:** no insert or update may leave `createdBy`/`updatedBy` unset. The service layer must
always set these from the authenticated user's id — never leave them to default to null on a
real write. (`deletedBy` follows the same rule for soft-deletes once it exists — see the todo doc.)

### Cascade deletes

Soft-delete cascades (e.g. deleting a Relationship Type that has Companies/Contacts tagged under
it) must be done explicitly in application code, inside a transaction — never a raw DB-level
`ON DELETE CASCADE` for soft-deletes. Every dependent row affected by the cascade must have its
own `deletedAt`/`deletedBy` set correctly, same as if it were deleted directly.

**Rule:** before a cascading delete is allowed to proceed, the user must see a clear warning
(styled with the brand red from the design system above) stating what will also be deleted and
roughly how many records are affected, and must re-enter their account password to confirm. No
silent or one-click cascading deletes.

### Deeper audit trail

Beyond the per-row `createdBy`/`updatedBy`/`deletedBy` (which only ever show the *last* actor),
significant mutations are also recorded as their own row in a separate `audit_logs` table (who,
what entity/record, when, what changed). `AuditLogService` (`backend/src/core/audit-log/`) is
registered in the global `CoreModule`, so any service can call
`auditLogService.record({ entityType, entityId, action, actorId, changes })` with zero extra
module wiring — no generic interceptor, an explicit call inside each service's own create/update/
delete method, matching how the rest of this codebase is built. `changes` is a full snapshot for
insert/delete, a field-level `{ field: { old, new } }` diff for update (only the fields that
actually changed).

**Rule:** a failed audit-log write must never fail the caller's real operation — `record()` is the
one deliberate exception to the "never swallow, always rethrow" rule elsewhere in this doc: it
logs the failure as an error and returns, it does not rethrow.

**Rollout is table-by-table**, not all at once — `relationship_type` (create/update/delete) is
done; every other table's services still need this added the same way, one at a time, tracked in
`todo-audit-infrastructure.md`.

### Terminal logging

- **Backend:** already satisfied — `backend/src/core/logging/request-logger.middleware.ts` is
  applied globally (`consumer.apply(RequestLoggerMiddleware).forRoutes("*")` in `app.module.ts`)
  and logs method, path, status, duration, query, and body (with password/token redaction) for
  every request. Do not remove or bypass this when adding new routes.
- **Frontend:** not yet satisfied — `serverFetch` (`frontend/src/lib/api/server-client.ts`) and
  `apiFetch` (`frontend/src/lib/api/client.ts`) currently make requests silently. Once added
  (tracked in the todo doc), every call through either helper must log method, path, and
  status/duration — to the Next.js server terminal for `serverFetch`, and the browser console for
  `apiFetch` — matching the backend's pattern.

### Deep debug logging inside every backend endpoint

The request-logger middleware above only proves a request happened and what it returned — it says
nothing about *why*, which branch of the logic ran, or where inside a multi-step service call
something went wrong. Every controller method and the service method(s) it calls needs its own
internal trail, visible in the backend terminal (`docker logs orelia-backend-1`) without attaching
a debugger.

**Rule, for every new backend endpoint from now on:**

- Give the class its own `private readonly logger = new Logger(ClassName.name);` (NestJS's
  built-in `Logger` — no new dependency; `debug`/`verbose` levels are already enabled outside
  `NODE_ENV=production` in `main.ts`, so these show up immediately in dev).
- Log entry to the method with its meaningful inputs: `this.logger.debug(\`GET /pickers/companies
  called (search=${search ?? "none"})\`)`.
- Log every conditional branch actually taken, not just the outcome — e.g. "Applying name search
  filter", "No search filter provided, returning unfiltered top 20", "Excluding company id X from
  results". If there's an `if`/`else`, each branch gets its own debug line explaining which path
  was taken and why.
- Log the result shape on the way out (row count, not full payloads — avoid dumping PII/secrets
  into logs, matching the existing password/token redaction precedent above).
- Wrap the method body in `try { ... } catch (err) { this.logger.error(...); throw err; }` — log
  the failure, then **rethrow** (never swallow) so NestJS's normal exception handling and HTTP
  status codes are untouched. This applies at both the controller layer and the service layer, so
  a failure's log trail shows which layer it actually happened in.

Reference implementation: `backend/src/modules/pickers/pickers.controller.ts` and the picker
methods in `companies.service.ts`/`contacts.service.ts`/`employees.service.ts`/
`departments.service.ts`/`industries.service.ts` — every endpoint there follows this exactly.
Retrofitting this to every already-built endpoint is tracked as its own item in
`_bmad-output/implementation-artifacts/todo-audit-infrastructure.md`, not done piecemeal here —
same "new code follows the rule now, old code catches up later as its own pass" precedent used for
i18n and the picker-permission split above.

## TypeORM Gotcha: never `save()` an entity that was loaded with relations

**Rule: the entity object passed to `repository.save()` (or `saveScoped()`) must always be loaded
bare (no `relations` option, no `leftJoinAndSelect`).** Load a bare entity for the mutation,
mutate it, save it, and — if the caller needs display data (resolved names, joined records) —
re-fetch a *separate*, relations-loaded copy afterward purely to build the response.

**Why this is a rule and not just a style preference**: discovered 2026-07-21 while building View
Deal — `deals.service.ts`'s `update()` and `moveStage()` both loaded the `Deal` via
`findOneWithRelations()` (needed six-then-ten `leftJoinAndSelect`s for display purposes: company,
owner, stage names, etc.), mutated one or two fields on that same object, then called
`saveScoped()`. This silently **nulled every relation-backed FK column on the row**
(`company_id`, `contact_id`, `primary_contact_id`, `source_id`, `department_id`,
`pre_sales_person_id`, `pmo_id`) on every single update/move — confirmed empirically: reproduced
with as few as one relation loaded, reproduced with zero DTO fields touching those columns
(`moveStage` never even referenced them), gone completely the instant the entity was loaded with
*zero* relations. It was only ever caught because `deals` happens to have a `CHECK` constraint
(`company_id IS NOT NULL OR contact_id IS NOT NULL`) that turned the corruption into a loud 500
instead of a silent data loss. **Any other entity with the same load-with-relations-then-save
pattern and no equivalent CHECK constraint would lose its relation columns on every partial update
with no error at all.** Audited: no other service in this codebase does this today — every other
`findOneOrFail` used ahead of a mutation loads bare (`findOneScoped({where:{id}})`, no `relations`
option) — Deals was the only one combining "needs relations for display" with "the same method is
also used to fetch the mutation target." Keep it that way: if a future resource's `findOneOrFail`
needs relations for its own display purposes, split it into two methods the way
`deals.service.ts` now does (`findOneOrFail` for relations/response, a private
`findOneBareOrFail` for the entity that actually gets mutated and saved), never one method serving
both purposes.

## API Endpoint Registry

Every backend endpoint is tracked in a single table-view reference:
`_bmad-output/implementation-artifacts/api-endpoint-registry.md`. It lists, per endpoint: method,
path, RBAC-vs-picker type, required permission(s), purpose, request data shape, response data
shape, controller/service location, frontend consumer(s), and whether it's been brought up to the
"Deep debug logging inside every backend endpoint" standard above. The intent is that someone can
understand the shape of the whole API surface by reading that one file, without opening every
controller.

**Rule:** whenever a backend endpoint is created, moved, renamed, re-gated, or has its
request/response shape changed, update that table in the same change — not as a follow-up, not
batched later. A registry that drifts from the real code is worse than no registry.

The table is filled in section-by-section as each part of the system is reviewed (same pace as
the rest of this project), not retrofitted for the entire existing API in one pass — see that
file's own notes for what's covered so far and what's still pending.

## Permission Model ✅ migrated

Every resource gets exactly **four** permissions: `_VIEW`, `_CREATE`, `_UPDATE`, `_DELETE`. There
is no `_MANAGE` wildcard, on any resource, new or existing.

**Rule:** never add a new `_MANAGE` permission key to any resource, from now on, no exceptions.

**Migration complete** for `TENANTS`, `USERS`, `RBAC`, `TEAMS`, `RELATIONSHIP_TYPE`,
`RELATIONSHIP`, `MAIN_STAGE`, `SUB_STAGE`, `DEPARTMENT`, `DEAL_SOURCE` — all ten `_MANAGE` keys
deleted from `permissions.ts`, every controller guard and frontend `hasManage` fallback trimmed,
both roles that held any of them (`Admin`, `Super Admin`) migrated onto the granular equivalents
first (verified via direct DB query — zero access lost), and `Sidebar.tsx` changed from checking
one hardcoded permission key per nav item to checking "does the user hold *any* permission under
this resource's prefix" — so removing a resource's `_MANAGE` key (or changing its permission set
again later) never requires a matching `Sidebar.tsx` edit.

**Not yet migrated:** `DEAL_STAGES_MANAGE` — a dead wildcard (zero controllers ever checked it)
superseded by `MAIN_STAGE_*`/`SUB_STAGE_*`'s own granular permissions. Tracked as its own task in
`_bmad-output/planning-artifacts/plan-funnel-deal-management.md` (Task 4), since it needs no
migration (nothing to move access to) — just deletion, once picked up.

Companies/Contacts/Deals never had a `_MANAGE` key at all (already 4-permission by design) — the
only fix needed there was renaming their read action from `_READ` to `_VIEW` for naming
consistency with every other resource, also done.

## RBAC Routes vs. System-Internal (Picker) Routes

Every backend route falls into exactly one of two categories — pick one deliberately for every
new route, don't default into the wrong one:

- **RBAC routes** — gated by the resource's own `_VIEW`/`_CREATE`/`_UPDATE`/`_DELETE`
  permissions (see Permission Model above). This is the default for anything that reads or
  writes a resource's own admin data.
- **System-internal routes** ("picker" routes) — reachable by *any authenticated user inside the
  system*, regardless of whether they hold that specific resource's own permissions. **Never
  reachable without authentication at all — "system-internal" means inside our own logged-in
  system, not the public internet.** Used only for narrow lookups: id+name pairs for dropdowns,
  search-selects, filters, and column headers elsewhere in the app. Never expose a resource's
  full fields or admin actions through one of these.

**Current state:** each resource module currently defines its own `/resource/picker` endpoint
inside that resource's own controller (e.g. `GET /departments/picker` in
`departments.controller.ts`, alongside `companies.controller.ts`, `contacts.controller.ts`,
`employees.controller.ts`), gated on a broad permission like `DEALS_READ` rather than that
resource's own admin permissions — e.g. a user without Department-admin rights still needs to
pick a Department when creating a Deal. This already follows the rule below correctly, but the
endpoints themselves are scattered one per module instead of collected in one place.
Consolidating them into a single dedicated pickers module/controller (one file mirroring the
frontend's own `frontend/src/lib/pickers/server.ts`, which already aggregates every picker fetch
function in one place) is a one-time cleanup — track it in
`_bmad-output/implementation-artifacts/todo-audit-infrastructure.md` rather than doing it
piecemeal as a side effect of unrelated feature work.

**Rule:** a system-internal/picker route must never be gated behind the resource's own admin
permissions. Gate it on whatever permission the *consumers* of that dropdown/filter actually hold
instead — exactly like the existing Departments/Companies/Contacts/Employees pickers already do.
New pickers must follow this same split: full CRUD stays an RBAC route behind the resource's own
permissions; the picker is a system-internal route behind the consumer's permission.

## Internationalization (i18n)

Every user-facing string in the frontend — button labels, page titles/subtitles, tab names, field
labels, placeholders, tagline/empty-state text, and validation/error messages — must be a lookup
key into a translation file, never a hardcoded string in JSX.

**Rule:** no new component may hardcode user-facing text. Add the string to the English label
file first (structure: one JSON file per language, organized by feature/component, e.g.
`{ "funnel": { "title": "Funnel", "addNewDeal": "Add New Deal" }, "addDealDialog": { "tabs": {
"dealInfo": "Deal Information" }, "errors": { "dealNameRequired": "Deal name is required" } } }`),
then reference it by key. Additional language files are added later as siblings to the English
one, same key structure; the UI switches file based on the user's language selection. The exact
lookup mechanism/library (e.g. `next-intl`) is a decision for whoever builds the first real
i18n-enabled feature — not decided yet, don't assume one.

Retrofitting every *already-built* section (all 9+ admin sections, Relationships, Deals) to this
is tracked in `_bmad-output/implementation-artifacts/todo-system-wide-i18n-and-permissions.md`,
not done piecemeal here. New features from now on must be built with this from the start —
see `_bmad-output/planning-artifacts/feature-development-guideline.md` for the full checklist.
