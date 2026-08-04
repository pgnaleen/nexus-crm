# Dashboard gap analysis — reference screenshots + persona review, reconciled (2026-08-04)

Written by Mary (Business Analyst persona). Synthesizes three things that turned out to be
partially in conflict: (1) five reference screenshots from an earlier supervisor's attempt at this
same business requirement, shared this session; (2) the existing
`dashboard-widgets-by-persona-analysis.md` (CEO/Manager/Rep/Admin gap review, written earlier
today against a since-superseded plan); (3) what actually got built this session — Stories 1.9 and
1.10 in `epics-system.md`: a permission-filtered, backend-persisted, drag/resize widget grid with
5 bundled metrics endpoints and a user-selectable display currency.

**Reconciliation decision (confirmed with the client): the Story 1.9/1.10 grid architecture is the
going-forward foundation.** A separate, earlier-planned effort had committed to a different
architecture instead — a fixed, department-tabbed page with no drag/resize, backed by one
`GET /deals/dashboard` endpoint on the `deals` module. That plan is **superseded and removed**
(its own handoff doc, `sales-pipeline-dashboard-handoff.md`, was deleted once its content was
confirmed fully captured here and in `epics-system.md`'s Stories 1.9/1.10 — its two completed
building blocks, `MainStage.weightPercent` and the FX-rate service, are already part of the grid
build). Its good ideas (department-tab filtering, deal-source win-rate, per-partner weighted
value) are folded into the recommendations below instead of being lost.

---

## 1. What the reference screenshots reveal

The screenshots are from **the same real business requirement, attempted before in a different,
failed system** — per your own words, that system "didn't map the requirement correctly and the
base wasn't developed correctly." So the underlying business need is genuine and worth building
toward; the specific data model that prior system used is not to be copied uncritically.

**Key finding: "Workspace" is not a new concept — it maps to ORELIA's existing Deal Source.**
Confirmed with direct evidence, not just inference: this tenant's real `deal_sources` table
already has a source literally named **"CEO"**, matching the "CEO" workspace card in the
screenshot exactly, and `FunnelSourceTabs.tsx` already renders one tab per Deal Source ("Track
deals by acquisition source") — the same structural role Workspace plays in the reference
dashboard (every other chart sliced by it first). No new entity needed; existing widgets should
slice by `DealSource` as the lead dimension, not bury it in one stacked-bar chart.

What the screenshots show that ORELIA doesn't have yet:

| Screenshot element | ORELIA equivalent today | Gap |
|---|---|---|
| Pipeline by Workspace (per-source deal count, win %, sparkline strip) | `dealsBySource` exists but isn't the lead cut of the dashboard | No source-first drill-down |
| Deals by Business Unit | `DealsByDepartmentChartWidget` | This one genuinely is Department-shaped, not Deal Source — stays as-is |
| Partner Pipeline Breakdown (deals, pipeline value, weighted value) | `PartnersInsightWidget` — deal count only | Missing value + weighted columns |
| Deal Count by Stage, with visible conversion % (10/20/35/50/70/85/100%) | `DealsByStageChartWidget` shows count only | `MainStage.weightPercent` already exists and already feeds `revenueForecast.projected` invisibly — just needs to be surfaced as a visible number next to each stage |
| Pipeline Value by Stage | `ValueByStageChartWidget` | Equivalent, no gap |
| "Weighted Pipeline" as its own top-level KPI ("probability-adjusted value") | Only exists buried inside `revenueForecast.projected`, monthly-bucketed | Should be its own stat card: `SUM(open deal value × stage.weightPercent)`, not just a forecast-chart series |
| Budget vs Commit vs Pipeline (per workspace/source, monthly, fiscal-quarter) | Nothing | Two new concepts with zero schema equivalent — see Open Questions |
| Closed Won as one combined card (count + win rate together) | Split into two separate stat cards | Cosmetic — a call, not a gap |

## 2. What the persona analysis (CEO / Manager / Rep / Admin) already flagged

Still valid findings from `dashboard-widgets-by-persona-analysis.md`, re-verified against what
actually exists after Stories 1.9/1.10 (several are already resolved by this session's work):

| Gap | Status after Stories 1.9/1.10 |
|---|---|
| At-Risk Deals | ✅ **Already built** — `AtRiskDealsListWidget`, real data, 14-day-stuck threshold |
| Revenue/pipeline trend over time | ✅ **Already built** — `RevenueForecastChartWidget`/`RevenueTrendChartWidget`, real monthly data |
| Users by Role, Tenant Growth (Admin) | ✅ **Already built**, real data |
| Task Completion | ✅ Already real (tenant-wide %), though still not scoped to "my tasks" for a rep — see below |
| Per-rep breakdown (deals/pipeline/win-rate per salesperson) | ❌ Still a gap — `deal_role_assignments` already has the salesperson link, same query shape as `PartnersInsightWidget` |
| Deal source win-rate (not just volume) | ❌ Still a gap — `dealsBySource` only counts, doesn't show conversion |
| Rep-personal view ("my pipeline," "my at-risk," "my close dates," "my tasks") | ❌ Still the single biggest gap — zero personal/rep-scoped widgets exist; everything built is tenant-wide |
| Admin: security activity, RBAC hygiene, backup status, data-hygiene reminders | ❌ Still a gap — all reuse already-shipped services (`ActivityLogService`, `DbBackupService`, `rbac_role_user_map`), independent of the deals-pipeline work entirely |
| Win/loss reason analysis | ❌ Still schema-blocked — confirmed no `lostReason`/`closeReason` field exists anywhere on `Deal` |
| `TaskCompletionDonutWidget` has no permission gate, shows to everyone | Still true — worth revisiting once it becomes a "my tasks" widget (see rep-personal gap above) |

## 3. Consolidated recommendations (not yet built, needs prioritization)

Grouped by how ready each is to build vs. how much needs deciding first:

**Ready to build now (real backing data exists, just needs a widget/query)**
- Stage conversion % surfaced visibly on `DealsByStageChartWidget`/`ValueByStageChartWidget`
- Weighted Pipeline as its own stat card
- Partner Pipeline Breakdown gains pipeline value + weighted value columns
- Deal source win-rate alongside existing volume count
- Per-rep breakdown (deals, pipeline value, win rate per salesperson via `deal_role_assignments`)
- Rep-personal widget set ("my pipeline," "my at-risk," "my upcoming closes," "my tasks" — the
  last one is pure reuse of the already-shipped Priority Tracker data)
- Admin widgets: security/sign-in activity (`ActivityLogService`), RBAC hygiene, backup status
  (`DbBackupService`), data-hygiene reminders (deals owned by a terminated employee — the exact
  class of bug `CLAUDE.md`'s "Selectable Scope" rule already documents)

**Needs a scoping decision before building (open questions, below)**
- Budget vs Commit vs Pipeline chart
- Win/loss reason analysis (needs a new `Deal` column/lookup table first)

## 4. Open questions — still need your/the stakeholder's answer

1. **What defines a deal's "Commit" tier?** A manually-set field (dropdown: Pipeline / Commit /
   Best Case), or derived automatically from stage (e.g. everything past "Negotiation" counts as
   Commit)?
2. **What defines "Budget"?** Who sets it (Tenant Admin? per-source owner?), at what granularity
   (per source per month? per quarter?), and does a fiscal-year concept need to exist at all —
   nothing in `Tenant` currently has a fiscal-year-start setting, so "Q3 FY2026" has no anchor yet.
3. **What should "lost reason" categories be**, and who's allowed to set one (the deal owner at
   the moment it's marked Lost? anyone with `DEALS_UPDATE`)?
4. **Prioritization**: of the "ready to build now" list above, which matters most next — the
   screenshot-driven items (stage %, weighted pipeline card, partner value/weighted, source
   win-rate) or the persona-driven items (per-rep breakdown, rep-personal view, admin widgets)?
   They're independent efforts and can be sequenced either way.
