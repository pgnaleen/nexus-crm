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
| `--color-crm-primary` | `#ED1B24` | Primary action buttons, active sidebar item, key badges/status indicators, form focus rings — never the shell background |
| `--color-crm-primary-hover` | `#C70F19` | Hover / pressed state for primary actions |
| `--color-crm-primary-tint` | `#FDEBEC` | Alert backgrounds, row highlights (light tint of primary) |
| `--color-crm-primary-glow` | `rgba(237,27,36,0.15)` | The form focus-ring glow only. Exists because `box-shadow` needs the primary at 15% alpha and Tailwind can't derive that from `--color-crm-primary` inside a composite shadow value — see the note below |
| `--color-crm-shell` | `#022B5D` | Sidebar/header/app-shell background — the navy base of the shell's dot+gradient treatment (see below) |
| `--color-crm-shell-gradient-start` | `#04162E` | Same shell gradient's darker navy starting point (0% stop) |
| `--color-crm-shell-gradient-end` | `#1A5FA8` | Same shell gradient's lighter navy corner-glow endpoint (100% stop); `--color-crm-shell` itself is the 55% midpoint |
| `--color-crm-bg` | `#F8FAFC` | Page and card background |
| `--color-crm-text` | `#0F172A` | Body copy and headings |

**Rule:** the primary red (`#ED1B24`) must stay confined to primary action buttons, the active
sidebar menu item, key badges/status indicators, and form focus rings. **Never** use it as a
large solid surface fill, and never in the shell's background gradient — the shell background is
navy only. If red starts showing up elsewhere, replace it with the navy shell color or a neutral
grey.

**Brand color note.** Three near-identical reds have been in play. `#ED1B24` is the value the
delivered Nexus logo SVGs were exported with, and on 2026-07-28 the client chose it as the
app-wide `--color-crm-primary` so the logo and every other red surface match exactly. The two
rejected candidates, recorded so this isn't re-litigated: `#E91C2D` (the token's own earlier
value) and `#EA0A2A` (confirmed directly from `orelit.com`'s theme CSS,
`--wp--preset--color--accent: #ea0a2a`). All three are genuinely red, not orange, despite how
they can read on some displays, and the differences are a few points in the blue channel —
imperceptible side by side. Which one is *correct* was a brand-authority call, not a visual one.
This does **not** change where red is allowed to appear (see the rule above) — the client
separately confirmed the shell background should stay navy (matching this section's original
`#022B5D` value) with no red in it at all; red stays confined to the four usages listed.

**The glow token is the one deliberate duplicate.** `--color-crm-primary-glow` restates the
primary as `rgba()` at 15% alpha because Tailwind cannot derive an alpha variant of a custom
property inside a composite `box-shadow` value. **When the brand red changes, both must be
edited.** This is the single exception to the one-line-rebrand rule below, and it exists because
the alternative was worse: before 2026-07-28 there was no glow token and ten separate components
each hardcoded `rgba(233,28,45,0.15)` inline — so changing `--color-crm-primary` left every form
focus ring glowing the *previous* brand red, with nothing to catch it. If a future Tailwind
version can express `color-mix()` or an alpha modifier here, collapse this token back into
`--color-crm-primary` and delete this paragraph.

**Shell background technique.** The dashboard/sidebar shell (`frontend/src/app/[tenant]/
(dashboard)/layout.tsx`) uses the same dot+gradient+blur-blob technique as the login page
(`frontend/src/app/[tenant]/page.module.css`), but anchored entirely to the `--color-crm-shell*`
tokens above instead of the login page's own separate blue hex values — a radial-gradient dot
texture, a soft linear-gradient from `-gradient-start` through `--color-crm-shell` to
`-gradient-end`, plus two blurred glow blobs (`bg-crm-shell-gradient-end/30`,
`bg-crm-shell/30`). Sidebar nav-item hover state is a plain `white/10` overlay, not red — the
written rule above only lists the *active* item as an approved red usage, not hover.

**Approved exception — Priority Deck quadrant palettes.** The Priority Tracker's Eisenhower board
(`frontend/src/app/[tenant]/(dashboard)/priority/`) carries its own sixteen `--color-pd-*` tokens in
the same `@theme` block: four quadrants × `-soft`/`-fill`/`-acc`/`-word`. These are taken verbatim
from the client's own `orel-tasks_2.html` prototype and **include blue** (`--color-pd-de-acc:
#4f8cf6`, the DECIDE quadrant) — a deliberate, scoped exception to the "no blue anywhere" rule above,
signed off by the client. The justification: four quadrants need four mutually distinguishable hues,
and these are content-area fills inside one module, never app chrome. The exception does **not**
extend beyond that board — buttons, focus rings, nav, and every other surface still follow the rules
above, and no other module may introduce blue by citing this precedent. Documented so it stops being
re-flagged as a violation on every review. (Epic 2 of
`_bmad-output/planning-artifacts/epics-task-management.md`, Story 2.1.)

**Single-source-of-truth rule:** never hardcode a raw hex or `rgba()` color value in a component
for anything that represents one of the tokens above — reference the token instead, either as a
plain Tailwind utility (`bg-crm-primary`, `hover:bg-crm-shell/30` for opacity variants) or, for
complex arbitrary properties Tailwind can't express as a simple utility (e.g. a multi-stop
`background-image` gradient), via `var(--color-crm-primary)` inside the arbitrary-value bracket
syntax. The point: changing the brand color should only ever require editing the token lines in
`globals.css`'s `@theme` block, never hunting through component files for hardcoded hex strings.
The primary red spans two of those lines, not one — `--color-crm-primary` and its `-glow` alpha
restatement (see the glow-token note above); everything else is a single line.

**This rule extends to the logo.** `NexusLogo` inlines the brand SVG as React paths *specifically*
so its red can be `var(--color-crm-primary)` rather than a baked-in `#ED1B24`. Do not "simplify"
it into an `<img>` pointing at a static file — that trades a one-line rebrand for hand-editing
every SVG. The one place the hex is unavoidably literal is `frontend/src/app/icon.tsx`, which
renders the tab icon outside the document via Satori and so has no access to CSS custom
properties; it is commented as such.

### Typography

No formal type scale exists yet — this is the first written note on it, extracted from what
`.funnel-title` (used by every admin section's page title: Departments, Deal Sources, etc.)
already established as the de-facto convention. Documenting it now so it doesn't drift the way
the Dashboard heading did (was built at 15px/600, a leftover from an old unrelated CSS rule,
before being caught and corrected to match).

| Role | Size / weight |
|---|---|
| Page title (e.g. "Dashboard", "Department Management") | `text-[26px] font-bold` |
| Card/section title (e.g. "Widgets" panel header) | `text-sm font-semibold` (14px) |
| Body / table cell text | `text-sm` (14px) or `text-[13.5px]`, regular weight |
| Muted/secondary text (labels, timestamps) | `text-xs` (12px) or smaller, `text-[var(--color-text-muted)]` |

This isn't exhaustive — extend it as new patterns get established, the same way the color tokens
above grew from a handful of documented rules into the actual palette in use.

### Multi-tab dialogs: fixed panel size across tabs

A dialog with tabs must not change size when the user switches tabs — every tab panel is wrapped
in the same fixed-height scroll container, so the dialog's footprint is identical whichever tab
is active and overflow scrolls *inside* the panel instead of stretching the dialog:

```tsx
{activeTab === "someTab" && (
  <div className="h-[480px] overflow-y-auto pr-1">
    ...tab content...
  </div>
)}
```

**Rule:** every new dialog (or component) with tabs wraps *each* tab panel in this container from
day one. The height is per-dialog, not global: size it to the dialog's tallest tab's natural
content, capped at `620px` (the Add Deal dialog's standard) — past the cap, that tab just
scrolls internally, which is also what absorbs tabs whose content grows at runtime (contact
lists, documents, notes). Shorter tabs simply leave blank space below their fields — that's the
point, not a bug to "fix" by shrinking the wrapper.

If the panel itself is a CSS grid, put the sizing classes straight on it but add
`content-start` — a fixed-height grid otherwise stretches its auto rows to fill the height
(`align-content: stretch` default), spacing the content out weirdly on short tabs.

Done: `AddDealDialog` (`h-[620px]`, the reference), `CompanyFormDialog` (`h-[620px]`),
`EmployeeFormDialog` (`h-[480px]`), `EmployeeDetailDialog` (`h-[380px]`, grid variant, loading
spinner given the same height so the dialog doesn't resize when data arrives). Still to retrofit
when next touched: `ViewDealDialog`.

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
4. Phase 1 — app shell only (sidebar, top nav, main content wrapper, page background). **In
   progress**: sidebar, top nav (search bar, date/time, account/notification trigger buttons),
   main-content wrapper, and shell background (navy dot+gradient+glow, see Color tokens above)
   are done, restyled with Tailwind utility classes referencing the `@theme` tokens (no
   hardcoded hex). Account-menu and notification dropdown *contents* (not their trigger buttons)
   are deliberately deferred to Phase 5 (dropdown menus).
5. Phase 2 — dashboard cards (KPI/metric cards, activity cards, quick actions, empty
   states/skeletons). **Done** for the two cards that exist today: the KPI stat-card grid
   (`StatCard.tsx`, `dashboard/page.tsx`) and the activity list (`ActivityWidget.tsx`), including
   switching their icon-box tint from the old ad-hoc blue (`#eef1fb`/`--color-brand`) to the
   documented `--color-crm-primary-tint`/`--color-crm-primary` tokens, consistent with "no blue
   anywhere." No quick-actions widget or empty-state UI exists on the dashboard yet, so that part
   of this phase's listed scope doesn't apply to current code — revisit if/when one is built.
6. Phase 3 — tables and lists (data tables, search bars, filter dropdowns, status badges,
   pagination, row hover states, empty states). **Done** across all 15 consumers (5 admin
   widgets, 4 layout table widgets, `RelationshipViewWidget`, Backups/Employees/Contacts/
   Companies/Deals pages) plus the shared `SearchSelect` trigger, `StatusBadge`, and
   `UserStatusBadge` components. Deliberately **not** touched, staying in scope for Phase 5
   instead: `SearchSelect`'s open-menu content (a dropdown menu), and the shared `.icon-btn`/
   `.icon-btn-danger`/`.content-card`/`.empty-state*`/`.field-label` classes, which remain in
   `globals.css` since components outside this phase's table/list scope still depend on them.
   Two status-badge components (`StatusBadge`, `UserStatusBadge`) had a real color fix alongside
   the class migration: "Trial"/"Invited" used the old ad-hoc blue (`#eef1fb`/`#2f6feb`) —
   switched to the same amber pairing used elsewhere for a neutral "pending" state, per the
   client's "no blue anywhere" rule (see the Color tokens section above). No pagination exists
   anywhere yet, so that part of this phase's listed scope doesn't apply to current code.
7. Phase 4 — forms (text inputs, selects, textareas, checkboxes/radios, validation error
   styling, save/cancel buttons). **Done.** Shared components migrated first for leverage:
   `Button.tsx` (fixed a real bug in the same pass: its primary variant used the old
   `--color-primary` dark-grey token, never the brand red, despite being *the* save/submit button
   on every form — now `bg-crm-primary`), `TextField.tsx`, `EmailField.tsx`, `PhoneField.tsx`
   (wrapper only; the third-party phone-input library's own internal styling untouched),
   `PasswordField.tsx`, `PasswordStrengthHint.tsx`, and the `.dialog-actions` footer wrapper
   across all 17 of its consumers. Also fixed the shared focus-ring glow from blue
   (`rgba(47,111,235,...)`) to the brand red, per the "form focus rings" rule and "no blue
   anywhere." Then all ~20 remaining dialogs with inline `.field`/`.field-error`/
   `.field-checkbox-row`/`.field-textarea`/`.field-hint`/`.field-locked-value`/`.field-row` usage
   were migrated file-by-file: 5 admin form dialogs, 6 layout form/detail dialogs, 2 relationship
   dialogs (`CompanyFormDialog`/`ContactFormDialog` — the largest, ~750 lines each), and several
   smaller standalone error messages found during a final sweep that weren't in the original
   survey. All now-dead CSS rules removed from `globals.css`, including the `.password-*` rules
   that became dead once `PasswordField`/`PasswordStrengthHint` were migrated. `.field-label`
   (used by `SearchSelect`/`MultiSelect`) and `.permissions-*` (a bespoke picker UI, not a
   standard form field) were deliberately left alone — out of scope for this phase.
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

**Exemption — pure join/link tables.** A bare many-to-many join table whose only job is to
associate two already-audited rows (no state of its own beyond the pair + who created it) is
exempt from extending the audited base and from soft-delete. Such a row is either *present* or
*hard-removed* by its own explicit "unlink"/"unshare" action — it is never "updated", and it has
no tenant column of its own (it inherits scope through its already-tenant-scoped parent). It still
records `createdBy` and still writes an `audit_logs` row on both link and unlink, so the actor
trail is preserved. Approved instances: `deal_partners_map`, `priority_task_shares`. Do **not**
extend this exemption to any table that carries its own mutable state or lifecycle — those follow
the full rule above. (Documented so this specific, deliberate pattern stops being re-flagged as a
violation on every review.)

### Cascade deletes

Soft-delete cascades (e.g. deleting a Relationship Type that has Companies/Contacts tagged under
it) must be done explicitly in application code, inside a transaction — never a raw DB-level
`ON DELETE CASCADE` for soft-deletes. Every dependent row affected by the cascade must have its
own `deletedAt`/`deletedBy` set correctly, same as if it were deleted directly.

**Rule:** before a cascading delete is allowed to proceed, the user must see a clear warning
(styled with the brand red from the design system above) stating what will also be deleted and
roughly how many records are affected, and must re-enter their account password to confirm. No
silent or one-click cascading deletes.

**Rule — a cascade must reach the real leaf entity, not stop at a join/tag table.** Discovered
2026-07-28 during a full audit prompted by the client: `RelationshipTypesService.remove()` (and
the single-party `RelationshipPartiesService.remove()` used by the "Delete Company/Person" button)
both only soft-delete the `relationship_company_contact_map` row — the tag linking a Company or
Contact to a Relationship Type. Neither ever touches the underlying `Company`/`Contact` row's own
`deletedAt`/`deletedBy`. The visible symptom: delete a Relationship Type (or a single Company/
Person card under one), the confirm dialog correctly warns "this will also delete N tagged
companies/contacts," but those Companies/Contacts stay fully active underneath — still returned by
every picker (e.g. still selectable when creating a new Deal), still visible to any other
Relationship Type they also happen to be tagged under, effectively un-deletable by a normal user
ever again. **Fixed 2026-07-28** — both `RelationshipPartiesService.remove()` and
`RelationshipTypesService.remove()` now cascade the real soft-delete down to the Company/Contact
(and a deleted company's own owned Contacts), each getting its own `audit_logs` row (not just a
count folded into the parent's entry), and each blocked with a `ConflictException` naming the
still-referenced records if any of them has an active Deal reference — mirroring the guard
`removeContactForCompany()` already had. Verified live: booted the app, ran both delete paths
against real throwaway rows, confirmed `companies`/`contacts` rows actually got
`deletedAt`/`deletedBy` set and each produced its own `audit_logs` delete row. The rule going
forward, for any *new* cascade: when a cascade's warning dialog tells the user N records will be
deleted, the code must actually soft-delete all N of those records (each with its own audit log
row), not just the association row that pointed at them. Before shipping any new cascade, trace it
all the way to the leaf entity and confirm via a real DB query that the leaf row's `deletedAt`
actually changed, not just the join table's.

**Known residual data issue:** this bug shipped before the fix above, so 6 Companies and 1 Contact
in the live database are still soft-orphaned from it (a `relationship_company_contact_map` row
that's deleted, pointing at a Company/Contact that isn't) — found via direct query during the same
audit. Not backfilled automatically; needs an explicit one-time cleanup decision (which rows,
confirmed with the client) rather than a silent bulk soft-delete.

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

**Rollout status (audited + completed 2026-07-28):** `AuditLogService.record()` is now wired into
create/update/delete for every table with its own service: `relationship_type`,
`relationship_party` (company/contact tagging), `department`, `deal_source`, `user`, `rbac_role`
(+ role-resource/role-user assignment), `team`, `tenant`, `deal`, `deal_partner`, `deal_document`,
`deal_note`, `deal_tender_detail`, `employee`, `certification`, `priority_task` (+
`priority_task_share`), and — added in this pass, previously the one real gap — `main_stage` and
`sub_stage` (`backend/src/modules/deal-stages/`).

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

## Selectable Scope: pickers hide inactive records; edit forms keep the current value

A whole class of bug lives at the boundary between "a record still exists" and "a record is still
a *valid choice*." A record can be soft-deleted (gone), but it can also be **deactivated,
disabled, suspended, terminated, resigned, cancelled, or archived** — still in the table, but no
longer something a user should be able to *newly pick* or *assign*. TypeORM's automatic
`deletedAt IS NULL` filter handles the first case for free; it does **nothing** for the second,
which is app-level and must be written explicitly. Forgetting it means deactivated deal sources,
terminated employees, and disabled users keep showing up in dropdowns as if nothing changed —
silently ignoring the very toggle an admin used to retire them.

**Rule 1 — every picker/lookup filters its entity's inactive-state, not just soft-delete.** When
you add or touch a picker/dropdown/selectable-list endpoint (or a client-side options list), check
whether the entity has any "no longer a valid choice" column and exclude those rows. Known
status shapes in this codebase (each expressed differently — there is deliberately **no** shared
`findSelectable()` helper, because a boolean, a 4-value enum, and a status enum don't abstract
cleanly):

| Entity | Column | Exclude when |
|---|---|---|
| Employee | `employmentStatus` enum | `Terminated` / `Resigned` (On-Leave stays selectable) |
| User | `status` enum | not `Active` |
| Department | `isActive` boolean | `false` |
| DealSource | `isActive` boolean | `false` |
| RelationshipCompanyContactMap (deal customer/partner) | `isActive` boolean | `false` |
| Tenant | `status` enum | `Suspended` / `Cancelled` (product decision — not yet enforced) |

Reference implementations (all follow the same shape — filter after the scoped fetch, treat a
missing status as active): `employees.service.ts` `findPicker` and `findLinkable`,
`users.service.ts` `findPicker` (`status: Active`), `departments.service.ts` `findPicker`
(`isActive: true`), and the `party.is_active = true` clause in `companies.service.ts` /
`contacts.service.ts` `findPickerForRelationshipType`. For a list endpoint that is **dual-use**
(admin list *and* picker — e.g. `GET /deal-sources`, whose full list also builds the funnel tabs),
do **not** filter the shared endpoint; filter in the picker *consumer* instead (see
`AddDealDialog.tsx`'s `activeDealSources`).

**Rule 2 — an edit form must keep its current value even after that value became inactive.** Rule 1
creates a trap: if a deal's Sales Person was terminated after the deal was created, the picker no
longer lists them, so the edit form would show the field **blank** and silently null it on save.
Every edit form must re-append the record's *own current value* to the options when the picker
would otherwise hide it — using the resolved name the API already returns (add one to the response
if it isn't there, as was done for `territoryOwnerName` on `CompanyResponse`). The appended entry
displays the current value but can't be re-selected once changed. Reference implementations:
`AddDealDialog.tsx` (Sales Person / Pre-Sales / PMO, and the deal-source fallback),
`CompanyFormDialog.tsx` (territory owner), and `employees.service.ts` `findLinkable` (re-adds the
already-linked employee server-side). A **filter** control is the deliberate exception — the funnel
Sales Person *filter* derives its options from the loaded deals precisely so a terminated owner's
historical deals stay findable; filtering is not assigning.

## Internationalization (i18n)

Every user-facing string in the frontend — button labels, page titles/subtitles, tab names, field
labels, placeholders, tagline/empty-state text, and validation/error messages — must be a lookup
key into a translation file, never a hardcoded string in JSX.

**Rule:** no new component may hardcode user-facing text. Add the string to the English label
file first (structure: one JSON file per language, organized by feature/component, e.g.
`{ "funnel": { "title": "Funnel", "addNewDeal": "Add New Deal" }, "addDealDialog": { "tabs": {
"dealInfo": "Deal Information" }, "errors": { "dealNameRequired": "Deal name is required" } } }`),
then reference it by key. Additional language files are added later as siblings to the English
one, same key structure; the UI switches file based on the user's language selection.

**Mechanism decided ✅**: lightweight custom solution, no new npm dependency (`next-intl`/
`react-i18next` were considered and rejected). `frontend/src/locales/en.json` is the single
English dictionary — one file per language, nested by feature/component exactly as shown above.
`t(key, vars?)` in `frontend/src/lib/i18n.ts` does the dot-path lookup (e.g.
`t("departments.dialog.saveButton")`) with `{placeholder}` interpolation (e.g.
`t("departments.deleteConfirm.message", { name: department.name })`); it falls back to returning
the raw key if a path doesn't resolve, so a missing translation is visibly wrong rather than
silently blank. It's a plain synchronous function (no Context/Provider, no hook) so the same
`import { t } from "@/lib/i18n"` call works identically in Server and Client Components — there is
only one language today, so there is no active-locale state to thread through yet. When a second
language is added, `dictionary` in `i18n.ts` becomes a lookup keyed by the active locale (cookie or
route param) instead of a hardcoded constant; call sites do not change.

Proven end-to-end on Departments (`departments` namespace in `en.json`,
`DepartmentsWidget.tsx`/`DepartmentFormDialog.tsx` fully retrofitted) as the reference
implementation for retrofitting every other section.

Retrofitting every other *already-built* section (Tenants/Roles/Users/Teams, Relationship
Types/Deal Sources/Main Stages/Sub Stages, Relationships, Deals, Employee Management, and shared
UI primitives' own built-in text) to this is tracked in
`_bmad-output/implementation-artifacts/todo-system-wide-i18n-and-permissions.md`, not done
piecemeal here. New features from now on must be built with this from the start —
see `_bmad-output/planning-artifacts/feature-development-guideline.md` for the full checklist.
