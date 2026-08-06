# Epic 2: System — UI Modernization & Dashboard (in-progress — 8/10)

Part of the split epics tracker — see [`../EPICS.md`](../EPICS.md) for the status-source note and
the "Unsorted / Current Focus" cross-cutting items shared across every file in this folder.

Tailwind/FlyonUI migration (per `CLAUDE.md`'s Design System phase list) plus the dashboard's
evolution from a static mock to a permission-filtered, backend-persisted, real-data widget grid.

- [x] 2.1 Migrate App Shell to Tailwind
- [x] 2.2 Migrate Dashboard Cards
- [x] 2.3 Migrate Tables and Lists
- [x] 2.4 Migrate Forms
- [ ] 2.5 Migrate Modals and Interactive Components (Phase 5 — not started: modals, confirm
  dialogs, toasts/alerts, dropdown menus incl. account-menu/notification contents, tabs, drawers)
- [x] 2.6 Responsive QA Pass (Phase 6) — verified shipped directly in code (`flex-wrap` in
  `TopBar.tsx`, `overflow-x-auto` on table widgets, filter-bar wrapping) even though
  `sprint-status.yaml` still shows this as backlog; design notes: see git history, was
  `_bmad-output/4-design-plans/plan-phase6-responsive-qa.md`. Sidebar collapse was split out and
  shipped separately (see below).
- [ ] 2.7 Final QA Verification (color usage, component classes, no logic altered, across every
  story in this epic) — not started
- [x] 2.8 Customizable Widget Dashboard — Stage 1 (drag/resize, then a widget-picker side panel and
  a much larger dummy-widget library; localStorage-only, explicit documented limitation at the time)
- [x] 2.9 Permission-Filtered Widgets & Backend-Persisted Layout — closes 2.8's two deferred gaps:
  widgets now filter by the viewer's actual permissions, and layout/visibility/currency persist to
  a new `dashboard_preferences` table instead of `localStorage`. *(Added 2026-08-04, after
  `sprint-status.yaml` was generated — confirmed done directly from the epic file's own
  "CONFIRMED / DONE" marker and live-verification notes, not reflected in sprint-status.yaml.)*
- [x] 2.10 Real Backend Data for Dashboard Widgets + User-Selectable Display Currency (partial
  scope) — stat cards, revenue forecast/trend, deals-by-stage/value/source/department, at-risk
  deals, sales funnel, Partners Insight, Tenant Growth, Users by Role, and Task Completion all now
  query real data via 5 bundled endpoints (`backend/src/modules/dashboard/`), with
  `FxRatesService.convert()` normalizing multi-currency deals and a per-user display-currency
  selector. **Deliberately still dummy data:** `TargetRevenueGaugeWidget`, the Pipeline Coverage
  stat card, `WinLossReasonsChartWidget`, `TeamPerformanceRadarWidget` — each needs its own
  new-schema decision first (see the dashboard gap-analysis notes in `../EPICS.md`'s Unsorted
  section). *(Same 2026-08-04 addition as 2.9, not in sprint-status.yaml.)*

**Shipped outside this epic's own numbering, confirmed directly in code — sidebar collapse**
(`Sidebar.tsx`'s `manualOverride`/`isNarrow` state: manual icon-only toggle, remembered via
`localStorage`, auto-collapses below `lg` breakpoint, clicking a group icon while collapsed expands
and opens that group). Design notes: see git history, was
`_bmad-output/4-design-plans/plan-sidebar-collapse.md`.
