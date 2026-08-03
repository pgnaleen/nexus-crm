---
name: flyonui-migration
description: 'ORELIA CRM Tailwind/FlyonUI restyle migration process and current phase-by-phase status. Use before touching the styling of any existing (not-yet-migrated) screen or component, or when asked about migration progress, next phase, or what phase we are on.'
---

# FlyonUI Migration — Process & Phase Status

Moved out of `CLAUDE.md` on 2026-08-03 so it only loads when actually doing restyle work, not on
every turn. The color tokens, typography scale, and multi-tab dialog sizing rule this migration
follows still live in `CLAUDE.md`'s Design System section — read that first for the actual design
rules; this skill is the *process* for rolling them out screen by screen.

## Migration discipline

- One phase per session/turn. Verify the result (visually, in the browser) before moving to the
  next phase — never batch multiple phases into one pass.
- Restyling must never touch: API calls, routes, validation logic, submit handlers, state
  management, or data mapping/sorting/filtering logic. Only className/CSS changes are in scope
  for any styling phase.
- After each phase: list every file modified, and get explicit sign-off before starting the next
  phase.

## Phase order (do not skip ahead)

1. ✅ Setup check — confirmed: Next.js 14 App Router, no prior Tailwind, styles in
   `frontend/src/app/globals.css`, imported once from `frontend/src/app/layout.tsx`.
2. ✅ Install Tailwind + FlyonUI; configure the main CSS file. Preflight excluded, verified via
   full `next build` + visual regression across login/dashboard/funnel/Add-Deal-dialog/an admin
   section — no breakage.
3. ✅ Add the color tokens (as a Tailwind `@theme` block — see `CLAUDE.md`'s Color tokens section).
4. Phase 1 — app shell only (sidebar, top nav, main content wrapper, page background). **In
   progress**: sidebar, top nav (search bar, date/time, account/notification trigger buttons),
   main-content wrapper, and shell background (navy dot+gradient+glow) are done, restyled with
   Tailwind utility classes referencing the `@theme` tokens (no hardcoded hex). Account-menu and
   notification dropdown *contents* (not their trigger buttons) are deliberately deferred to
   Phase 5 (dropdown menus).
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
   client's "no blue anywhere" rule. No pagination exists anywhere yet, so that part of this
   phase's listed scope doesn't apply to current code.
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
