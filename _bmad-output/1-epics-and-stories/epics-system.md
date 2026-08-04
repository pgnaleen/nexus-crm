---
stepsCompleted: ['1.1', '1.2', '1.3', '1.8']
inputDocuments: ['CLAUDE.md']
---

# Nexus CRM — System Epic Breakdown

## Overview

System-level work that isn't tied to a single business feature (HR, Deals, Relationships, etc.)
— UI modernization, internationalization, deployment/infrastructure hardening. Stories are added
to this epic as each system-level initiative is picked up; not everything is planned upfront.

## Epic List

1. System — UI Modernization (Tailwind/FlyonUI Migration)

## Epic 1: System — UI Modernization (Tailwind/FlyonUI Migration)

Migrate the existing hand-written-CSS frontend to Tailwind CSS + FlyonUI utility classes, one
phase at a time, per the phase order and migration discipline already defined in `CLAUDE.md`
("Design System (FlyonUI)" section) — that section is the standing rule; this epic tracks actual
progress against it.

### Story 1.1: Migrate App Shell to Tailwind — CONFIRMED / DONE

As a **user of the CRM**,
I want **the sidebar, top navigation bar, and main content wrapper to use the app's real design
system (Tailwind/FlyonUI utility classes, driven by the documented brand-color tokens)**,
So that **the shell looks consistent with the brand and any future color change only requires
editing the token definitions, not hunting through component files**.

**Acceptance Criteria:**

**Given** the sidebar, top bar, and main content wrapper previously used hand-written CSS classes
(`.sidebar`, `.topbar`, `.dashboard-layout`, etc.)
**When** the migration is complete
**Then** all of their styling is expressed as Tailwind utility classes in the component JSX, and
the now-dead hand-written CSS rules are removed from `globals.css`

**Given** the shell background needs a decorative treatment
**When** the dashboard renders
**Then** it shows a navy dot-texture + soft gradient + blurred glow-blob background (same
technique as the login page), anchored entirely to the `--color-crm-shell*` tokens — no red
anywhere in the background, matching the client's explicit confirmation that the shell stays navy
and red stays confined to buttons/the active nav item/badges/focus rings

**Given** any color used in the shell (background, active nav item, hover states, avatar)
**When** the code is reviewed
**Then** there is no raw hardcoded hex or `rgba()` value representing a brand color — every one
is a reference to a token in `globals.css`'s `@theme` block, either as a plain Tailwind utility
(`bg-crm-primary`) or, for complex multi-stop gradients, via `var(--color-crm-*)` inside an
arbitrary-value Tailwind class

**Given** this is a styling-only phase
**When** the change is reviewed
**Then** zero API calls, routes, validation logic, submit handlers, state management, or data
mapping/sorting/filtering logic were touched — confirmed via unchanged backend/frontend behavior
and a clean `tsc --noEmit` run with no new errors beyond the pre-existing baseline

**Confirmation note (2026-07-22):** Sidebar (nav links, group toggles, chevrons, submenus),
top bar (search input, date/time display, account/notification trigger buttons), main content
wrapper, and the shell background are all migrated. Account-menu and notification *dropdown
contents* (not their trigger buttons) are deliberately deferred — they belong to Phase 5
(modals/dropdown menus) per `CLAUDE.md`'s phase order, not this shell phase. Brand color
confirmed directly from `orelit.com`'s own theme CSS (`--wp--preset--color--accent: #ea0a2a`) —
genuinely red, not orange, and effectively identical to the already-documented
`--color-crm-primary`. Verified via `tsc --noEmit` (error count unchanged from baseline) and
direct inspection of the compiled CSS + rendered HTML (not just source review) to confirm the
gradient, blobs, and hover states actually compiled and rendered as intended.

### Story 1.2: Migrate Dashboard Cards — CONFIRMED / DONE

As a **user viewing the Dashboard**,
I want **the KPI stat cards and activity list to use the app's design system tokens**,
So that **the dashboard's icon accents match the brand color rules instead of leftover ad-hoc
colors, and any future color change only requires editing the token definitions**.

**Acceptance Criteria:**

**Given** the stat-card grid, individual `StatCard`, and `ActivityWidget` previously used
hand-written CSS classes (`.dashboard-page`, `.stat-grid`, `.stat-card*`, `.activity-*`)
**When** the migration is complete
**Then** all of their styling is Tailwind utility classes in the component JSX, and the
now-dead hand-written CSS rules are removed from `globals.css` — `.content-card`/
`.content-card-title` and `.empty-state*` are deliberately left in place since 17+ other
table/list components still depend on them; only `ActivityWidget`'s own usage was converted

**Given** the stat/activity icon boxes previously used an ad-hoc light-blue tint
(`#eef1fb`/`var(--color-brand)`)
**When** the migration is complete
**Then** they use the documented `--color-crm-primary-tint`/`--color-crm-primary` tokens instead
— no blue anywhere, consistent with the client's brand-color rule from Story 1.1

**Given** this is a styling-only phase
**When** the change is reviewed
**Then** zero API calls, routes, or data-fetching logic were touched (the dashboard still uses
the same dummy/preview data it did before) — confirmed via a clean `tsc --noEmit` run with no new
errors beyond the pre-existing baseline, and direct inspection of the compiled CSS + rendered
authenticated HTML (not just source review)

**Confirmation note (2026-07-22):** No quick-actions widget or empty-state UI exists on the
dashboard yet, so that part of this phase's listed scope in `CLAUDE.md` doesn't apply to current
code — revisit if/when one is built, rather than inventing UI to satisfy the phase description.

### Story 1.3: Migrate Tables and Lists — CONFIRMED / DONE

As a **user of the CRM**,
I want **every table/list page's header, search bar, filter bar, table, and status badges to use
Tailwind utility classes driven by the documented tokens**,
So that **these pages look consistent with the rest of the migrated app, and a future color or
spacing change only requires editing the token definitions, not hunting through 15+ files**.

**Acceptance Criteria:**

**Given** the shared `SearchSelect` trigger button and 15 table/list-page consumers previously
used hand-written CSS classes (`.data-table`, `.status-badge`, `.table-actions`,
`.interactive-row`, `.tenant-management-wrapper`, `.funnel-header-*`, `.funnel-filters-*`,
`.funnel-add-btn`, `.funnel-clear-btn`, `.search-select-wrapper/trigger/value`)
**When** the migration is complete
**Then** all of their styling is Tailwind utility classes in the component JSX, and every one of
those now-dead hand-written CSS rules is removed from `globals.css`

**Given** classes still shared with components outside this phase's scope (`.icon-btn`/
`.icon-btn-danger` row-action buttons, `.content-card`/`.empty-state*` containers,
`SearchSelect`'s own open-menu content, `.field-label`)
**When** the migration is reviewed
**Then** those classes and their CSS rules are left untouched — converting them would mean
touching components that belong to Phase 5 (dropdown menus) or haven't been reached yet, not
this phase

**Given** two status-badge components hardcoded an old ad-hoc blue for "pending" states
**When** the migration is reviewed
**Then** `StatusBadge` ("Trial") and `UserStatusBadge` ("Invited") use the same amber pairing
already established elsewhere for neutral/pending states instead — no blue anywhere, consistent
with the client's brand-color rule from Story 1.1

**Given** this is a styling-only phase
**When** the change is reviewed
**Then** zero API calls, routes, or data-fetching/filtering logic were touched — confirmed via a
clean `tsc --noEmit` run with no new errors beyond the pre-existing baseline, and a real
authenticated fetch against all 15 migrated pages confirming 200 responses with no
error-boundary text

**Confirmation note (2026-07-23):** Covered all 5 admin widgets (Departments, Sub Stages,
Relationship Types, Main Stages, Deal Sources), all 4 layout table widgets (Users, Roles,
Tenants, Teams), `RelationshipViewWidget`, and the Backups/Employees/Contacts/Companies/Deals
pages, plus the shared `SearchSelect` trigger and `StatusBadge`/`UserStatusBadge` components. No
pagination exists anywhere in the current codebase, so that part of the phase's listed scope in
`CLAUDE.md` doesn't apply yet — noted rather than invented.

### Story 1.4: Migrate Forms — CONFIRMED / DONE

As a **user filling out any form in the CRM**,
I want **every input, button, and validation message to use the app's design system**,
So that **forms look consistent everywhere, and the primary Save button is actually the brand
red instead of a leftover dark-grey color that was never updated when the palette was chosen**.

**Acceptance Criteria (shared-component slice — DONE):**

**Given** `Button.tsx` previously rendered its primary variant using `--color-primary`
(`#16181d`, a dark grey never connected to the brand palette)
**When** the migration is complete
**Then** it uses `bg-crm-primary`/`enabled:hover:bg-crm-primary-hover`, and its base sizing
defaults to auto-width (matching how ~95% of its 24 consumers actually use it, inside dialog
footers) rather than the old always-100%-width default — the two consumers that genuinely want
full width (`LoginForm`, `BackupsWidget`) pass an explicit `w-full` override to preserve their
exact prior appearance

**Given** `TextField`/`EmailField`/`PhoneField` and the `.dialog-actions` footer wrapper (17
consumers) previously used hand-written CSS classes (`.field`, `.field-error`, `.btn`,
`.btn-primary`/`-secondary`, `.dialog-actions`)
**When** the migration is complete
**Then** all of it is Tailwind utility classes, and those specific now-dead CSS rules are removed
from `globals.css`

**Given** the shared focus-ring glow on every text input previously used blue
(`rgba(47,111,235,...)`, i.e. `--color-brand`)
**When** the migration is reviewed
**Then** it uses the brand red instead, consistent with CLAUDE.md's "form focus rings" rule and
the client's "no blue anywhere" instruction

**Confirmation note (2026-07-23, shared-component slice):** Verified via `tsc --noEmit` (baseline
unchanged) and a real authenticated fetch confirming the login page, Departments, Tenants, and
Users pages all render with no errors, including confirming the `w-full` override survived on
the login page's button.

**Acceptance Criteria (remaining ~20-file slice — DONE):**

**Given** ~20 dialog files (`DepartmentFormDialog`, `SubStageFormDialog`,
`RelationshipTypeFormDialog`, `MainStageFormDialog`, `DealSourceFormDialog`, `TeamFormDialog`,
`UserFormDialog`, `RoleFormDialog`, `TenantFormDialog`, `ResetPasswordDialog`,
`RolePermissionsDialog`, `CompanyFormDialog`, `ContactFormDialog`, `ChangePasswordForm`,
`RoleDetailsDialog`, `UserDetailsDialog`, `TenantDetailsDialog`, `TenantActingAsSwitcher`,
`SubStagesWidget`, plus `PasswordField`/`PasswordStrengthHint`) previously referenced
`.field`/`.field-error`/`.field-checkbox-row`/`.field-textarea`/`.field-hint`/
`.field-locked-value`/`.field-row` inline, for selects, textareas, checkbox rows, hint text, and
locked-value displays that don't go through the four shared components in the slice above
**When** the migration is complete
**Then** all of it is Tailwind utility classes, and every one of those now-dead CSS rules
(including the `.password-*` rules, dead once `PasswordField`/`PasswordStrengthHint` were
migrated) is removed from `globals.css`

**Given** `.field-label` (used by `SearchSelect`/`MultiSelect`) and the bespoke `.permissions-*`
picker UI inside `RolePermissionsDialog`
**When** the migration is reviewed
**Then** both are left untouched — `.field-label` belongs to a different shared component not in
this phase's scope, and `.permissions-*` is a custom widget, not a standard form field

**Confirmation note (2026-07-23, remaining slice):** `CompanyFormDialog`/`ContactFormDialog` were
the largest single files touched in this whole epic (~750 lines each). A final comprehensive
sweep across the entire `frontend/src` tree (not just the originally-surveyed 20 files) caught a
few additional standalone error messages that had been missed — including one inside
`DepartmentFormDialog` itself, from Story 1.1's own earlier partial edit — confirming the sweep
step matters even after methodical per-file work. Verified via `tsc --noEmit` (baseline
unchanged) and a real authenticated fetch across 7 representative pages (Departments, Sub
Stages, Deal Sources, Tenants, Users, Roles, Profile) all rendering with no errors.

### Story 1.5: Migrate Modals and Interactive Components — NOT STARTED

Phase 5 per `CLAUDE.md`: modals, confirmation dialogs, toasts/alerts, dropdown menus (including
the account-menu and notification-panel dropdown contents deferred from Story 1.1), tabs, drawers.

### Story 1.6: Responsive QA Pass — NOT STARTED

Phase 6 per `CLAUDE.md`: mobile/tablet sidebar collapse, sticky top bar, card stacking,
horizontally scrollable tables, usable forms on mobile, no overflow.

### Story 1.8: Customizable Widget Dashboard — Stage 1 (Drag-and-Drop Rearranging) — CONFIRMED / DONE

As a **dashboard user**,
I want **to click "Edit" and freely drag/resize the dashboard's widgets, like arranging apps on a
smartphone home screen**,
So that **I can arrange the dashboard the way that's most useful to me, instead of a fixed static
layout**.

This is Stage 1 of a larger three-stage initiative (see Stage 2/3 below) — deliberately scoped
to just the mechanism, using today's existing widgets, before adding new widget types or
role-based catalogs.

**Acceptance Criteria:**

**Given** I am viewing the Dashboard
**When** the page loads
**Then** the existing widgets (Tenants/Users/Roles/Teams stat cards + the activity list) render
inside a grid, in whatever arrangement was last saved (or a sensible default on first visit)

**Given** I click the "Edit" button
**When** edit mode is active
**Then** each widget shows a dashed outline affordance, and I can drag a widget to move it or
drag its corner to resize it — the grid automatically prevents overlap

**Given** I am in edit mode and rearrange widgets
**When** I click "Done"
**Then** edit mode exits, the dashed outlines disappear, dragging/resizing is disabled again, and
my arrangement persists across a page reload

**Given** this is still a dummy-data mock phase
**When** the change is reviewed
**Then** the arrangement is persisted to `localStorage` only, not the backend — no new API
endpoints, database columns, or per-user/tenant scoping exist yet; this is an explicit, documented
limitation, not an oversight

**Confirmation note (2026-07-22):** Built with `react-grid-layout` v2 (new dependency, chosen
over `dnd-kit` for being the established, boring, widely-used choice for exactly this pattern)
via its v2 hooks API (`useContainerWidth` + `gridConfig`/`dragConfig`/`resizeConfig`), not the
legacy v1 flat-props API. One real type issue hit and fixed: the hook's `containerRef` is typed
`RefObject<HTMLDivElement | null>`, which TypeScript's generic invariance doesn't consider
assignable to the `ref` prop's expected `RefObject<HTMLDivElement>` — resolved with a type-level
cast (`as RefObject<HTMLDivElement>`), not a runtime workaround, since both types describe the
same shape at runtime. Verified via `tsc --noEmit` (baseline unchanged) and direct inspection of
the rendered authenticated HTML confirming the grid, grid-item, and Edit-button markup all render.

**Stage 2 (2026-07-22) — DONE:** two new chart widgets added, both dummy-data, no new API calls —
`TenantGrowthChartWidget.tsx` (Recharts `AreaChart`, monthly tenant-count trend) and
`UsersByRoleChartWidget.tsx` (Recharts `PieChart`, users grouped by role). Both use the
`--color-crm-primary*` tokens (via `var()` inside SVG `stroke`/`fill`/`stopColor` — confirmed
these presentation attributes accept CSS custom properties in evergreen browsers) plus one
additional light-red tint and the existing neutral grey for a 4th pie slice — no blue anywhere,
consistent with the client's brand-color rule. Wired into `DashboardWidgetGrid`'s default layout
(bumped `STORAGE_KEY` to `-v2` since a `-v1` saved arrangement wouldn't have entries for the two
new widgets). Verified via `tsc --noEmit` (baseline unchanged) and a real authenticated fetch
confirming both chart headings and Recharts' own rendered markup appear with no error-boundary
text — a one-time "Fast Refresh had to perform a full reload" line in the dev server log when
the new client modules first loaded was a benign HMR quirk, not a persistent error (confirmed by
the very next request succeeding cleanly).

**Stage 3 — attempted, then explicitly reverted (2026-07-22):** a role-based widget catalog was
first built as a manual "Preview as" persona dropdown (System Admin / Tenant Admin / Tenant
Manager / Tenant User) filtering which widgets render. **The client rejected this approach as
the wrong shape and asked for it removed** — it was never meant to be a fake toggle. The actual
plan, for a later stage: clicking Edit opens a right-side panel listing every available widget to
scroll through and add, and each widget is tied to whichever section/permission its underlying
data belongs to, so a viewer only ever sees widgets for sections they genuinely have access to —
real permission-driven filtering, not a manual switcher. Neither the right-side panel nor any
per-widget permission concept exists yet; both are real, separate future work, not faked here.
The dropdown and its `WIDGET_CATALOG`/`Persona` code were fully removed, along with the two
stage-3-only dummy widgets that existed solely to populate it (`MyDealsStatWidget.tsx`,
folded into the general dummy catalog below instead).

**Also corrected in the same pass:** the Edit button was shrunk from a labeled pill button to a
small 32px icon-only button (`EditIcon` / `CheckCircleIcon` when active) — "hint-wise," per
direct feedback, not a large button demanding attention.

**Widget library expansion (2026-07-22):** since the real widget-picker panel is future work, the
immediate ask was simply to have a much larger library of dummy widgets to work with now. Added:
- 20 dummy stat cards, data-driven from a single array (`dummyStatCards.tsx`) rather than 20
  near-identical component files — `getDummyStatWidgets()` returns them keyed for the grid.
- 5 more chart/diagram widgets covering Recharts types not used yet: `RevenueTrendChartWidget`
  (line), `TeamPerformanceRadarWidget` (radar), `TaskCompletionDonutWidget` (radial bar, with a
  centered %-label overlay), `DealsBySourceStackedBarWidget` (stacked bar), and
  `SalesFunnelDiagramWidget` (Recharts' `FunnelChart` — a genuine diagram, not just another chart
  type). Combined with the 3 from Stage 2, that's 8 total chart/diagram widgets.
- The original 4 individual stat widgets (`TenantsStatWidget.tsx` etc.) were deleted — fully
  superseded by equivalent entries in the new dummy catalog; keeping both would have shown two
  redundant "Total Tenants"-style cards side by side.
- `dashboard/page.tsx` now auto-generates the grid layout programmatically (stat cards 6-per-row,
  charts 2-per-row) rather than hand-writing ~28 coordinate entries.

**Verification note:** `tsc --noEmit` baseline unchanged. Confirmed via a real authenticated
fetch that the persona dropdown is fully gone and every new widget's heading text renders with no
error-boundary text — including `RadialBarChart` and `FunnelChart`, the two less-common Recharts
types used for the first time here, which compiled and rendered without issue.

**Correction (2026-07-22, same day):** the widget-picker panel had been described above as
deferred future work — that was a misreading. Re-clarified: only *permission-based filtering of
the panel's contents* was meant to be deferred; the panel mechanism itself was expected now.
Built in the same pass:
- **Per-widget delete**: in edit mode, each widget shows a small trash-icon button (top-right
  corner overlay) that removes it from the dashboard.
- **"Add widgets" side panel**: in edit mode, a button opens a scrollable panel (to the right of
  the grid, not an overlay) listing every widget currently *not* on the dashboard by name;
  clicking one adds it back, auto-placed below existing widgets.
- Both which widgets are currently visible and their layout persist to `localStorage`
  independently (`orelia-dashboard-visible-v1` / `orelia-dashboard-layout-v4`).
- `dummyStatCards.tsx`'s `getDummyStatWidgets()` became `getDummyStatWidgetEntries()`, returning
  `{ label, node }` pairs instead of bare `ReactNode` — the panel needs each widget's label without
  rendering it, so every widget definition (stat cards and charts alike) now carries a name
  string alongside its rendered output.
- Still explicitly not built: filtering the panel's contents by the viewer's actual
  permissions/section access — every widget is listed to everyone for now, exactly as documented
  above; that part genuinely is later work, not this correction.

### Story 1.9: Permission-Filtered Widgets & Backend-Persisted Layout — CONFIRMED / DONE

As a **dashboard user**,
I want **to only ever see widgets for sections I actually have access to, and have my arrangement
survive across devices/browsers**,
So that **the dashboard reflects my real permissions instead of showing every widget to everyone,
and I don't lose my layout every time I clear localStorage or switch machines**.

Closes the two gaps Story 1.8 documented as deliberately deferred: no per-widget permission
filtering, and localStorage-only persistence.

**Acceptance Criteria:**

**Given** a signed-in user
**When** the Dashboard loads
**Then** only widgets whose section(s) they hold any permission for are shown — the same "any
permission under this resource prefix" rule `Sidebar.tsx` already uses for nav items, not an
exact permission key

**Given** the "Add widgets" panel is open
**When** it lists hidden widgets
**Then** it only offers ones the viewer actually has access to (no more "every widget listed to
everyone," Story 1.8's documented limitation)

**Given** a user rearranges, hides, or shows widgets
**When** they reload on a different device or browser
**Then** their layout and visibility are restored from the backend, not lost — `localStorage`
retired entirely

**Confirmation note (2026-08-04):** Built `frontend/src/lib/permissions.ts` (shared
`hasAnyPermissionForPrefix`, moved out of `Sidebar.tsx` so both share one implementation instead
of two copies of the same rule) and `frontend/src/components/widgets/widget-registry.tsx` (every
widget's required section prefix(es) + default grid position — e.g. Partners Insight requires
BOTH `deals` and `relationship`, since it blends two sections' data). `dashboard/page.tsx` became
an async Server Component that filters the registry against `session.permissions` before ever
building the widget map, matching every other page in the app's own session-fetching pattern.

New backend module `backend/src/modules/dashboard/` — `DashboardPreference` entity (one row per
tenant+user, extends `AuditedTenantEntity`, migrated live against the dev DB),
`GET`/`PUT /dashboard/preferences`, gated by authentication only (no `PermissionsGuard` — same
access model as Priority Tasks, since every user only ever reads/writes their own row).
`DashboardWidgetGrid.tsx`'s `localStorage` read/writes were replaced with a debounced `PUT`.

Verified live end to end with a real Super Admin session (`docker exec` against the running
containers, real login, real JWT cookie): `GET /dashboard/preferences` correctly returns an empty
body (Nest's `isNil` check treats `null` the same as `undefined`, which `serverFetch` already
handles by treating an empty response body as `null`) before any save; a `PUT` with a real layout
persisted; a follow-up `GET` returned the exact saved data back; and a real authenticated fetch of
the rendered dashboard page showed the heading, edit controls, and "Add widgets" panel with no
server error.

### Story 1.10: Real Backend Data for Dashboard Widgets, with a User-Selectable Display Currency — CONFIRMED / DONE (partial scope)

As a **dashboard user**,
I want **the widgets to show my tenant's real deal/tenant/user/task numbers instead of mock data,
and to be able to pick which currency amounts display in**,
So that **the dashboard is actually useful for real decisions, and a deal in one currency doesn't
get silently mixed with or misread against a deal in another**.

Replaces hardcoded `DUMMY_*` data with real aggregate queries for the widgets that have clear
backing columns in the schema — explicitly **not all 16 widgets** (see Deferred below).

**Acceptance Criteria:**

**Given** a user with `DEALS_VIEW`
**When** the Dashboard loads
**Then** stat cards, revenue forecast/trend, deals-by-stage/value/source/department, at-risk
deals, and the sales funnel all show real numbers from the tenant's own deals — not mock data

**Given** a user with `DEALS_VIEW` **and** `RELATIONSHIP_VIEW`
**When** Partners Insight renders
**Then** it shows deal counts grouped by companies actually tagged `systemRole=Partner` — not just
any company linked via `deal_partners_map`

**Given** a user with only `DEALS_VIEW` (no `RELATIONSHIP_VIEW`)
**When** `/dashboard/metrics/partners` is called
**Then** it 403s — AND, not OR, on the two permissions

**Given** deals recorded in different currencies (e.g. one in USD, one in LKR)
**When** any money figure is aggregated (pipeline value, revenue forecast, value by stage,
at-risk deal value)
**Then** every deal's value is converted into a single currency via `FxRatesService.convert()`
before summing — never a currency-mixed total

**Given** the dashboard's currency selector
**When** a user picks a different display currency
**Then** every widget showing money re-renders with amounts converted into that currency, and the
choice persists per-user (survives reload, same as widget layout)

**Given** `TENANTS_VIEW` / `USERS_VIEW` respectively
**When** Tenant Growth / Users by Role render
**Then** they show real per-month tenant creation counts and real RBAC role membership counts

**Given** any authenticated user
**When** Task Completion renders
**Then** it shows the tenant-wide % of Priority Tasks actually completed — canonical per-task
status, not per-user (unlike every other Priority Tasks query in the codebase)

**Deferred, still dummy data — explicit, not an oversight:** `TargetRevenueGaugeWidget` (no
quota/target table anywhere in the schema), the Pipeline Coverage stat card (same missing
denominator), `WinLossReasonsChartWidget` (no win/loss-reason field on Deal), and
`TeamPerformanceRadarWidget` (only "deals closed" is derivable — response time/follow-ups/
upsells/satisfaction have no backing columns anywhere). Each needs its own new-schema/product
decision before it can go real; scoped out of this story deliberately, per an explicit decision
made when this work was planned.

**Confirmation note (2026-08-04):** 5 new bundled endpoints
(`backend/src/modules/dashboard/dashboard-metrics.controller.ts` +
`dashboard-metrics.service.ts`), one per permission section rather than one per widget — mirrors
`widget-registry.tsx`'s own grouping so `dashboard/page.tsx` fetches each section's data in one
call. `getRequiredBundles()` in `widget-registry.tsx` ensures a bundle is only fetched if the
permission-filtered widget list actually needs it (never a guaranteed-403 call, never a wasted
call for a still-dummy widget). `avgGpMarginPercent` replicates `computeCosting()`'s formula
server-side so it matches what a deal's own detail page already shows (currency-independent, a
ratio, so it needs no conversion). `revenueForecast.projected` uses `MainStage.weightPercent`
(null treated as 0). Task completion resolves each task's canonical status via `DISTINCT ON`,
preferring a holder-type row over a `delegated` tracker row for the same task — a naive
`GROUP BY` would double-count a task that's simultaneously tracked by its delegator and held by
its recipient. `salesFunnel` and `revenueTrend` are not separate queries — they reuse
`dealsByStage`/`revenueForecast.actual` respectively.

Verified against a direct `psql` query on the real dev DB: 5 real deals, and `totalDeals`,
`pipelineValue` ($505,000 = $5,000 + $500,000), `avgGpMarginPercent` (85% = avg of 100% and 70%
margin across the two deals with a value), `dealsByStage`/`valueByStage`, and `atRiskDeals` (2
deals stuck 15 days) all matched exactly. Confirmed live via a real authenticated fetch of
`/system/dashboard` that the real numbers render with no application error.

**Currency selector, added same day after a follow-up product decision:** initial build fixed
every money figure to USD, converted via the existing `FxRatesService` (confirmed to already pull
from a live daily-refreshed API, `exchangerate-api.com`, cached in `fx_rates` — not fake data).
Revised to let the user pick the display currency instead: `DealsMetricsResponse` fields dropped
their `Usd` suffix (`pipelineValueUsd` → `pipelineValue`, etc.) and the response gained a top-level
`currency` field; `GET /dashboard/metrics/deals` accepts `?currency=`, threaded through
`DashboardMetricsService`'s `convertTo()` (renamed from the USD-only `toUsd()`). A new nullable
`currency` column on `dashboard_preferences` (migrated live) persists the choice per user, same
table/upsert as layout/visibility. New `DashboardCurrencySelector.tsx` (a dropdown sourced from
the existing `CURRENCIES`/`formatCurrencyLabel` in `frontend/src/lib/currencies.ts`) lives in
`DashboardWidgetGrid`'s header; selecting a currency immediately `PUT`s the preference and updates
the page's `?currency=` URL param via `router.replace`, which drives a fresh server render of
`dashboard/page.tsx` with the new currency (the money figures are server-fetched props, so this is
the only way to get new numbers — the grid's own layout/visibility client state is untouched by
this, no remount). New shared `frontend/src/lib/dashboard/currency-format.ts::formatDashboardAmount`
replaced each widget's own hardcoded `$`-prefixed formatter, using `Intl.NumberFormat`'s
`narrowSymbol` display for the prefix.

Verified live: inserted temporary test FX rates (1 USD, 300 LKR-per-USD) directly into `fx_rates`,
restarted the backend to reload `FxRatesService`'s in-memory cache, and confirmed
`/dashboard/metrics/deals?currency=lkr` returned exactly 300× the USD figures ($505,000 →
₨151,500,000) before deleting the test rows and restarting again to restore the real (currently
unconfigured, `FX_RATE_API_KEY` unset in this dev environment) empty-cache state. Confirmed the
real dashboard page renders correctly both with and without a `?currency=` param, selector visible,
no application error.

### Story 1.7: Final QA Verification — NOT STARTED

Confirm color usage, component classes, and that no logic was altered anywhere in the migration,
across all prior stories in this epic. (Numbered before 1.8 in this file since it was written
first, but should realistically run last, after every story above — including 1.8's later
stages — is complete.)
