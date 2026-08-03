# Dashboard widgets by persona — gap analysis (2026-08-04)

Written by Mary (Business Analyst persona) at the client's request: what should the dashboard
show for a CEO, a Manager, a normal (rep) user, and an Admin — versus what's implemented today and
what's already planned. This is a companion to `sales-pipeline-dashboard-handoff.md`, not a
replacement for it — that doc is the authoritative build plan for the real deals-analytics page
(Phases 1-5); this doc asks "once that ships, who is it actually serving, and who isn't it?"

**Caveat up front, worth remembering when reading this doc**: this system has no fixed "CEO" /
"Manager" / "Admin" / "rep" role anywhere in the code. RBAC roles are arbitrary rows a tenant admin
creates; only "Super Admin" is system-seeded (System tenant only). The four personas below are
conceptual — a way to reason about *who needs what*, which then maps onto whatever permission
bundle (`deals:*`, `tenants:*`, `users:*`, etc.) a real tenant admin assigns to a role they name
however they like. Nothing here should be read as "check `role === CEO`" anywhere in the codebase.

## Where things stand today

- The live `/dashboard` page is 22 widgets (`frontend/src/components/widgets/widget-registry.tsx`)
  in a drag/resize grid (`DashboardWidgetGrid.tsx`), and **every single one is mock data** — stat
  cards, charts, lists, all backed by hardcoded `DUMMY_DATA` constants, several with a "swap for a
  real endpoint later" comment still in place.
- Widget *visibility* already varies by permission (`requiredSectionPrefixes` per widget, filtered
  by `filterWidgetsByPermissions`) — e.g. Tenant Growth only shows to someone holding `tenants:*`.
  But widget *content* never varies — the numbers are the same fabricated values for everyone who
  can see a given widget.
- A real rebuild is already in progress and uncommitted (`sales-pipeline-dashboard-handoff.md`):
  Phase 1 (Main Stage weight%) and Phase 2 (FX rate conversion) are done; Phase 3 (`GET /deals/
  dashboard` — KPIs + stage/source/department/partner breakdown) is the next unstarted phase;
  Phases 4-5 are the frontend rebuild. This is a real, department-tabbed, currency-converted
  analytics page — a major step up from today's mocks. It has **no persona differentiation**: one
  page, same numbers, for whoever's looking (department tab aside).

## CEO / Executive

**Journey**: opens the dashboard rarely, wants the whole company's health in one glance — is the
pipeline growing, are we on pace, where's the risk concentrated — then leaves. Minimal operational
detail; anything that reads like "manage a specific deal" is the wrong altitude for this persona.

| Widget | Type | Status |
|---|---|---|
| KPI row (total deals, pipeline value, weighted pipeline, win rate, avg GP%) | Cards | ✅ Phase 3 covers this |
| Department breakdown (pipeline value + win rate per department) | Bar/table | ✅ Phase 3's `departmentBreakdown` |
| Funnel/stage breakdown | Funnel chart | ✅ Phase 3's `stageBreakdown` — visually this is what `SalesFunnelDiagramWidget` already mocks, just needs real data |
| **Revenue/pipeline trend over time** | Line/area chart | ❌ gap — Phase 3's response has no time dimension at all. The visual already exists (`RevenueForecastChartWidget`, `RevenueTrendChartWidget`) but nothing feeds it real time-series data |
| **Quota/target attainment** (Budget vs Commit vs Pipeline) | Gauge | ❌ deliberately out of scope per the handoff doc — no `SalesTarget`/quota entity exists. Re-flagging here because a CEO view with zero target-vs-actual is a real gap, but it needs its own scoping conversation (new entity), not a quick add |
| **Top movers** (biggest deals expected to close this month/quarter) | List | ❌ gap, but cheap — new idea, derivable from existing `estimatedValue` + `expectedCloseDate` on `Deal`, no schema change |

## Manager (sales/department lead)

**Journey**: opens the dashboard often, wants to know where to intervene today — which deals are
stuck, which rep needs help, which source is actually converting. Needs to go from "something's
wrong" to "here's who/what" in one screen, not just admire totals.

| Widget | Type | Status |
|---|---|---|
| Stage + source breakdown (own department, via the department tab) | Bar charts | ✅ Phase 3 |
| **At-risk / stuck deals** (in a stage N+ days) | List | ❌ gap — existed as a mock (`AtRiskDealsListWidget`) but was dropped from the Phase 3 spec entirely. Real "days in current stage" is derivable from `DealStageHistory`, which already exists and is already queried elsewhere in this codebase |
| **Per-rep breakdown** (deals owned, pipeline value, win rate, per Sales Person) | Table/bar | ❌ gap — Phase 3 has a `partnerBreakdown` but no equivalent grouped by the owning salesperson, despite `deal_role_assignments`/`salesPersonUserId` already existing to group by. Structurally the same query shape as the planned partner breakdown |
| Deal source ROI (win rate per source, not just volume) | Bar chart | ⚠️ Phase 3's `sourceBreakdown` only has `dealCount` — recommend adding win rate per source before Phase 5 builds its widget; "which sources convert" beats "which sources are biggest" for this persona |
| **Win/loss reason analysis** | Bar chart | ❌ gap, schema-blocked — verified no `lostReason`/`closeReason` field exists anywhere on `Deal`. Same category as the Budget chart: needs a scoping conversation + a new column before it's anything but the current mock's fabricated categories |

## Normal user (individual sales rep)

**This is the single biggest gap in the whole plan.** Phase 3-5 as currently spec'd has *zero*
personal/rep-scoped view — the entire planned page is department-wide. A rep opening the rebuilt
dashboard sees the same company-wide numbers a manager sees, with no view of their own book of
business anywhere. Their actual journey ("what do I need to do today") isn't served by any part of
the current or planned page.

| Widget | Type | Status |
|---|---|---|
| **My pipeline** (my open deals by stage, my pipeline value) | Cards + bar | ❌ gap — same query as Phase 3's stage breakdown, filtered to `salesPersonUserId = me` |
| **My at-risk deals** | List | ❌ gap — same underlying data as the Manager at-risk widget, scoped to self |
| **My upcoming close dates** (this week/month) | List | ❌ gap — cheap, `expectedCloseDate` already exists on `Deal` |
| **My tasks due soon** | List | ❌ gap — genuine reuse: the Priority Tracker feature (`priority-tasks` controller, already fully built and shipped) already has exactly this data. This is wiring, not new backend work |
| My personal win rate / closed-won trend | Stat + sparkline | ❌ gap — same shape as the CEO trend gap, scoped to self |

## Admin (tenant admin, or Super Admin on the System tenant)

**Journey**: not about deals at all — about whether the system itself is healthy. Wants to catch
problems (security, data hygiene, backups) before they become incidents, not analyze pipeline.

| Widget | Type | Status |
|---|---|---|
| Tenant Growth (tenants created/month) | Area chart | ✅ already exists (mock data, correctly gated to `tenants:*` — platform/Super-Admin only) |
| Users by Role (composition) | Donut | ⚠️ exists as mock; real version needs each tenant's own actual role/user counts, not the current fabricated split |
| **Recent sign-in / security activity** (failed logins, lockouts) | List/stat | ❌ gap, strong reuse opportunity — the Activity Log feature (`auth_events` table, `ActivityLogService`) already captures exactly this and has already shipped. Surfacing a small card here is mostly wiring |
| **RBAC hygiene** (users with no role, roles with zero permissions) | Stat/list | ❌ gap — new idea, cheap: a data-quality check over existing `rbac_role_user_map`/`rbac_role_resource_map`, no schema change |
| **Backup status** (last successful DB backup, next scheduled) | Stat card | ❌ gap — `DbBackupService`/`db-backup` controller already exists and runs nightly; nothing surfaces its status in the UI today |
| **Data-hygiene reminders** (deals still owned by a terminated employee) | Stat/list | ❌ gap, unique to this codebase's own documented pain point — the "Selectable Scope" rule in `CLAUDE.md` already describes this exact class of silent bug. A small admin widget turns a known-but-invisible issue into something actionable |

## Cross-cutting: one existing widget worth retiring or repurposing

`TaskCompletionDonutWidget` is the only widget in the current catalog with no permission gate at
all (`requiredSectionPrefixes: []`) — it shows to literally every logged-in user, hardcoded at 72%
with no real meaning attached. Recommend either scoping it into the rep's "My tasks due soon"
widget above (real Priority Tracker data, personal not global) or retiring it outright once real
widgets replace the mock catalog — leaving a permanent, meaningless placeholder isn't a good look
once everything around it is real.

## Sequencing suggestion (a BA's read, not a commitment)

- **At-Risk Deals** and **Per-Rep Breakdown** slot naturally into Phase 3/5 — same query shapes as
  what's already planned, no new concepts.
- **The rep-personal view** ("My pipeline," "My at-risk," "My close dates," "My tasks") is
  cleanest as its own Phase 6, since it's a differently-scoped variant of the whole page, not one
  more widget bolted onto the department view.
- **Admin widgets** (security activity, RBAC hygiene, backup status, data-hygiene reminders) are
  independent of the Sales Pipeline Dashboard rebuild entirely — they could ship on their own
  timeline, reusing already-built services, without waiting on Phase 3.
- **Trend-over-time, Quota/Target, and Win/Loss-Reason** all need their own scoping conversation
  (new schema or a genuinely new data source) before they're estimable — consistent with how the
  Budget/Commit chart was already deliberately deferred in the original handoff doc. Don't build
  any of these three off assumptions; they're listed here so they don't get silently forgotten,
  not because they're ready to build.
