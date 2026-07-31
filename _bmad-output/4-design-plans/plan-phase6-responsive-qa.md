# Phase 6 — Responsive QA pass (CSS-only fixes; sidebar collapse split out)

## Context

The user reported the Funnel page's Partner filter going off-screen on a smaller window. Root
cause, already fixed and committed: `FunnelSourceTabs.tsx`'s filter bar packed 7 controls into one
non-wrapping `flex` row with no overflow handling, and the page's `<main>` wrapper only scrolls
vertically — anything that didn't fit was simply unreachable.

A full audit (two Explore passes) found this is not an isolated bug — it's the state of the entire
frontend. Confirmed via grep: **exactly one file** in the whole app (`PriorityBoard.tsx`) uses any
Tailwind responsive breakpoint prefix. Everything else was built with a single fixed layout and
zero responsive variance. This matches CLAUDE.md's own FlyonUI migration plan, which explicitly
lists **"Phase 6 — responsive QA pass"** (sidebar collapse, sticky top bar, card stacking,
horizontally scrollable tables, usable forms on mobile, no overflow) as its own not-yet-started
phase. This plan is that phase — scoped to the CSS-only pieces; sidebar collapse (real
interaction/state design, not just CSS) is split out as a deliberate follow-up per the user's
decision.

**Decided approach:** patch each affected file in place (add the same `flex-wrap`/`overflow-x-auto`
classes already proven on `FunnelSourceTabs.tsx`), not a new shared component. Matches how every
other FlyonUI phase in this project was done — file-by-file, minimal touch, no new abstractions
introduced mid-phase. A shared `FilterBar` component is a legitimate future refactor once the
13-file duplication becomes an active maintenance cost, but is out of scope here.

## Scope

### 1. Filter bars / toolbars — 12 remaining files (same fix as `FunnelSourceTabs.tsx`)
Add `flex-wrap` at each nesting level of the existing `flex items-center gap-4` → search box →
`flex gap-3` filter-group structure, exactly like the already-committed Funnel fix. No JS/logic
touched, className-only.

- Tier 1 (3 controls): `contacts/page.tsx:29-84`, `deals/page.tsx:29-84`, `companies/page.tsx:29-85`,
  `components/layout/TenantsTableWidget.tsx:102-137`
- Tier 2 (2 controls): `employees/_components/EmployeesWidget.tsx:144-168`
- Tier 3 (search-only, lowest urgency but same shape): `admin/deal-sources/_components/DealSourcesWidget.tsx:125-140`,
  `admin/relationship-types/_components/RelationshipTypesWidget.tsx:138-153`,
  `admin/main-stages/_components/MainStagesWidget.tsx:131-146`,
  `admin/departments/_components/DepartmentsWidget.tsx:121-136`,
  `admin/sub-stages/_components/SubStagesWidget.tsx:143-158`,
  `components/layout/RolesTableWidget.tsx:111-126`,
  `components/layout/TeamsTableWidget.tsx:84-99`,
  `components/layout/UsersTableWidget.tsx:156-171`,
  `relationships/[id]/_components/RelationshipViewWidget.tsx:184-199`

Not touched: `CertifiedSearchWidget.tsx` (search is already `flex-1`, not fixed-width — not at
risk), `BackupsWidget.tsx` (no filter row), `OrgChartWidget.tsx` (not a filter bar).

### 2. Tables — wrap all 12 in `overflow-x-auto`
Every `<table className="w-full border-collapse text-[13px]">` renders with no scroll container
around it, inside `.content-card` (which sets no `overflow` rule). Wrap each table in a plain
`<div className="overflow-x-auto">` — the minimal, standard fix; no column-hiding/priority logic,
matching this phase's CSS-only scope.

Files (table's own `<table>` line noted for reference): `UsersTableWidget.tsx:184`,
`TenantsTableWidget.tsx:164`, `RolesTableWidget.tsx:135`, `TeamsTableWidget.tsx:112`,
`DealSourcesWidget.tsx:171`, `RelationshipTypesWidget.tsx:184`, `MainStagesWidget.tsx:176`,
`DepartmentsWidget.tsx:149`, `SubStagesWidget.tsx:171`, `EmployeesWidget.tsx:186`,
`RelationshipViewWidget.tsx:230`, `CertifiedSearchWidget.tsx:91`.

Not touched: `deals/page.tsx` — no real table exists yet (static stub), nothing to fix.
`FunnelBoard.tsx`/`FunnelSourceTabs.tsx`'s tab row already handle horizontal overflow correctly
(cited as the pattern to match, not a gap).

### 3. Top bar (`components/layout/TopBar.tsx`)
Plain flex row (`flex flex-shrink-0 items-center gap-4`, line 40) with a fixed `w-80` search box
(line 41) and a `ml-auto` icon-button group (line 52) — no wrap, no breakpoint handling. On a
narrow window the notification/account icons get silently clipped by the shell's `overflow-hidden`
wrapper, with no scrollbar to recover them. Fix: add `flex-wrap` to the header row plus a
sensible `gap-y` fallback, same pattern as the filter bars — if the search box + date/time + icons
don't fit one line, the icon group wraps to its own row rather than disappearing.

### 4. Dialog internal grids — collapse to 1 column on narrow viewports
`Dialog.tsx`/`.dialog-panel` itself already shrinks correctly (`width:100%; max-width:Npx` inside a
viewport-covering flex overlay) — not a gap, confirmed by the audit. The real "usable forms on
mobile" gap is inside the dialogs: every `grid grid-cols-2 gap-3.5` field row (repeated ~10x each
in `CompanyFormDialog.tsx` and `EmployeeFormDialog.tsx`) never collapses, squeezing two fields into
whatever narrow width the dialog has shrunk to. Change the recurring `grid-cols-2` → `grid-cols-1
sm:grid-cols-2` in both files (the two largest/most-repeated offenders — every other FormDialog in
the app is smaller/simpler and lower-priority for this pass). Also add `flex-wrap` to
`RolePermissionsDialog.tsx`'s controls row (search + 2 filter selects, same unwrapped-flex shape as
the filter bars).

Not touched: `SidePanel.tsx` (already caps at `maxWidth: "100%"` — cited as the correct pattern,
not a gap).

## Explicitly out of scope (follow-up items, not this plan)
- **Sidebar collapse** — real interaction/state design (hamburger toggle, drawer behavior,
  possibly persisted preference), not a CSS patch. Per the user's decision, scope this as its own
  deliberate next step once this CSS-only pass lands and is verified.
- Building a shared `FilterBar` component — noted as a legitimate future refactor, deliberately not
  done now per the user's decision to match this project's established file-by-file phase pattern.

## Execution order (checkpoints, verified before moving to the next)
1. Filter bars (12 files) → frontend typecheck → visual spot-check.
2. Tables (12 files) → frontend typecheck → visual spot-check.
3. Top bar (1 file) → frontend typecheck → visual spot-check.
4. Dialog grids (3 files) → frontend typecheck → visual spot-check.

## Verification
No browser automation tool is available in this environment — every step is verified by (a)
`pnpm --filter @orelia/frontend run typecheck` staying clean beyond the pre-existing unrelated
baseline errors already known from prior sessions, and (b) the user manually resizing their
browser window on the affected pages to confirm controls wrap/scroll instead of disappearing.
State this limitation plainly rather than claiming visual proof that wasn't actually obtained.
