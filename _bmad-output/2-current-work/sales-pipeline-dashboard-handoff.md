# Sales Pipeline Dashboard — Handoff / Status

Written for someone picking this up cold. Two separate pieces of work are covered: one finished
and merged, one in progress and **not yet committed**.

---

## 1. Relationship Tags Tab — done, committed, nothing to do

Committed as `2ff3d34 feat(relationships): add Relationship Tags Tab for Company/Contact
dialogs`. Full spec/history: `_bmad-output/3-feature-specs/spec-relationship-tags-tab.md`
(status `done`, has a "Suggested Review Order" if you want to read the diff). Adds a
"Relationships" tab to `CompanyFormDialog.tsx`/`ContactFormDialog.tsx` showing a hub-and-spoke
diagram of which Relationship Types a Company/Contact is tagged under, plus an add-tag picker.
Went through two rounds of adversarial code review; both are logged in the spec's own Spec
Change Log. Nothing outstanding here — mentioned only so it isn't confused with the work below.

---

## 2. Sales Pipeline Dashboard — in progress

### Why

The old `/dashboard` page (`frontend/src/app/[tenant]/(dashboard)/dashboard/page.tsx`) was a
drag/resize widget grid where every stat card and chart was 100% hardcoded dummy data — no
backend for it existed at all. The client wants it replaced with a real, deals-focused pipeline
analytics page: a funnel-stage breakdown with per-stage completion weights, a deal-source
breakdown, department tabs, a KPI row, a per-department breakdown, a per-partner pipeline
breakdown, all convertible into one selected display currency.

### Decisions already made (don't re-litigate these without a reason)

- **Stage weighting** ("New Lead 10%, Qualified 20%, ... Closed Won 100%"-style badges): no
  probability/weight column existed on any stage entity — added `MainStage.weightPercent`
  (nullable, admin-configurable). Lives on `MainStage` only, not `SubStage`, since a deal isn't
  required to have a Sub Stage.
- **Currency**: each Deal already has its own real `currency` (ISO 4217), but there was zero FX
  conversion infrastructure anywhere. **Client explicitly chose a live exchange-rate API**, not
  manual admin-entered rates and not a no-conversion fallback.
- **Aggregation strategy**: genuine SQL-level `GROUP BY`/`SUM`, not the bulk-fetch-and-reduce-
  client-side pattern the Funnel board uses — a dashboard computing six KPIs shouldn't ship every
  deal to the browser to summarize.
- **Widget mechanism**: dropped the drag/resize grid for this page entirely — fixed layout, not a
  user-rearrangeable catalog. (`DashboardWidgetGrid.tsx` and the old dummy widgets are left in the
  codebase, just unused by this page — didn't delete them in case they're wanted elsewhere.)
- **"Budget vs Commit vs Pipeline" chart** (was in the reference screenshot): explicitly **out of
  scope**. No schema concept exists for it (no target/quota/commitment entity — Deal only has
  `estimatedValue`). Needs a new `SalesTarget`-style entity before it's anything but fabricated
  numbers. Don't build this without a fresh scoping conversation.

### Phasing

Following this project's own "one phase per session, get sign-off before the next" discipline.

- ✅ **Phase 1 — `MainStage.weightPercent` schema + admin UI.** Done, verified, awaiting the
  client's own click-through sign-off (not yet confirmed as of this handoff).
- ✅ **Phase 2 — FX rate integration.** Done, verified with a real app boot.
- ⬜ **Phase 3 — `GET /deals/dashboard` aggregation endpoint.** Not started. Biggest single
  chunk — see below for the detailed spec.
- ⬜ **Phase 4 — Frontend page rebuild** (department tabs, currency selector, KPI row, funnel
  breakdown widget). Not started.
- ⬜ **Phase 5 — Remaining breakdown widgets** (source, department, partner). Not started.
- 🗒️ **Backlog, not scheduled**: Budget/Commit/Pipeline chart (see above).

---

### Phase 1 — what was built (files, all uncommitted)

- `backend/src/database/migrations/1784700000034-AddWeightPercentToMainStages.ts` — new
  nullable `numeric(5,2)` column on `main_stages`. Nullable and NOT defaulted to 0 —
  "unconfigured" and "explicitly weighted at 0%" need to stay distinguishable.
- `backend/src/modules/deal-stages/entities/main-stage.entity.ts` — `weightPercent?: number | null`
- `backend/src/modules/deal-stages/dto/create-main-stage.dto.ts`,
  `update-main-stage.dto.ts` — `@IsOptional() @IsNumber() @Min(0) @Max(100) weightPercent?:
  number | null`
- `common/src/contracts/deal-stages.contracts.ts` — `weightPercent` on
  `CreateMainStageRequest`/`MainStageResponse`
- `backend/src/modules/deal-stages/main-stages.controller.ts` — included in the response
- `frontend/src/app/[tenant]/(dashboard)/admin/main-stages/_components/MainStageFormDialog.tsx` —
  new "Weight %" field. **Important detail**: the payload sends `null` (not `undefined`) when the
  field is cleared, because this app's PATCH endpoints drop `undefined` keys entirely
  (`JSON.stringify` behavior) — sending `undefined` would leave an already-set weight untouched
  instead of clearing it. If you add more optional numeric/nullable fields to any dialog in this
  app, copy this pattern, not the naive `undefined` one.
- `frontend/src/app/[tenant]/(dashboard)/admin/main-stages/_components/MainStagesWidget.tsx` —
  new "Weight %" column in the table

No changes were needed to `frontend/src/lib/api/main-stages.ts` — it's already generically typed
off the shared contracts, so the new field flows through automatically.

**Manual test still owed**: boot the app, go to `/admin/main-stages`, set a weight on a stage,
confirm it saves and displays, clear it back to blank, confirm it actually clears.

---

### Phase 2 — what was built (files, all uncommitted)

- `backend/src/database/migrations/1784700000036-CreateFxRates.ts` — new platform-level
  `fx_rates` table (no `tenant_id` — market rates aren't tenant data). Extends the standard
  `AuditedEntity` shape (uuid `id` PK, not `currency_code` itself), with a plain unique index on
  `currency_code`.
- `backend/src/core/fx-rates/entities/fx-rate.entity.ts`
- `backend/src/core/fx-rates/fx-rates.service.ts` — the whole integration:
  - Provider: **exchangerate-api.com v6** (keyed, free tier 1,500 req/month, ~161 currencies),
    called via native `fetch` (no new npm dependency — Node ≥20 has it globally).
  - In-memory `Map<currencyCode, unitsPerUsd>` cache, loaded from the DB at boot
    (`onModuleInit` → `loadCacheFromDb()`), not from the live API on every restart.
  - Daily refresh at 03:00 local via `SchedulerRegistry`/`CronJob` — same pattern as the existing
    `DbBackupService`. Also fetches once immediately at boot if the cache is empty (fresh
    install), so it doesn't sit dark until the next 3am.
  - `getRate(code)` / `convert(amount, from, to)` — both synchronous/in-memory, `convert()` never
    throws; if either currency has no known rate it returns the amount unconverted plus a
    `warning` string instead of silently mis-reporting a total. **This is the piece Phase 3 needs
    to actually use** — every converted-sum KPI in the dashboard endpoint should route through
    `convert()` and surface `warning`s in a `conversionWarnings` response field, not just trust
    every deal's currency has a rate.
  - `FX_RATE_API_KEY` / `FX_RATE_API_BASE_URL` — optional in `env.validation.ts` and
    `.env.example`. **No key is configured in this dev environment yet** — the service degrades
    gracefully (logs a warning, serves an empty/stale cache) rather than crashing. Set
    `FX_RATE_API_KEY` whenever real rates are wanted; no code change needed, just the env var
    (sign up at exchangerate-api.com for a free key).
- `backend/src/core/core.module.ts` — registers `FxRate`/`FxRatesService` as a plain provider,
  **not** its own separate module — matches the existing `MailService`/`S3Service` pattern
  exactly (both are single-purpose external-integration boundaries with no controller of their
  own, registered directly in the already-`@Global()` `CoreModule`). If you're tempted to give FX
  rates its own `FxRatesModule` file, don't — it'd be inconsistent with how this codebase already
  does this.

**Two real bugs were caught during verification and fixed — know these before touching this code
again:**
1. The migration's number (`1784700000035`) collided with another migration already applied by
   unrelated concurrent work in this repo (`1784700000035-DropDealsLegacyTeamColumns.ts`).
   Renumbered to `1784700000036`. **Always run `ls -t backend/src/database/migrations/ | head -5`
   right before creating a new migration** — this repo has multiple people/sessions adding
   migrations concurrently, and the "next number" can go stale between when you check it and when
   you actually write the file.
2. `loadCacheFromDb()` originally had no error handling and was called unconditionally from
   `onModuleInit()`. With the migration not yet applied, it threw an uncaught exception and
   crashed the **entire app** into a boot-crash-restart loop — not just this feature. Fixed by
   wrapping it in try/catch (falls back to an empty cache on any DB error). **If you add more
   `OnModuleInit` logic anywhere that touches the DB, always ask "what happens if this table/query
   fails" — an uncaught rejection in a module init hook takes the whole app down, not just that
   module.**

Verified with a real Docker container restart + log check (not just `tsc`), confirming actual
successful boot: `FxRatesService loadCacheFromDb loaded 0 rate(s)` → `WARN FX rate provider
disabled (FX_RATE_API_KEY unset)` → `Nest application successfully started`.

---

### Phase 3 — next up, not started: `GET /deals/dashboard`

On the **existing** `deals` module (not a new top-level module) — reuses `DealsRepository`.
**Must be declared before the `:id` route** in `deals.controller.ts` (same reason
`GET /deals/partner-links` already is — verified that ordering directly in this codebase).

Query params: `departmentId?` (omitted = all departments), `displayCurrency` (required, ISO 4217).

Single response covers everything in one round trip (`DealsDashboardResponse`, new shape to add
to `common/src/contracts/deals.contracts.ts`):

```ts
export interface DealsDashboardResponse {
  displayCurrency: string;
  ratesAsOf: string | null;
  conversionWarnings: { currency: string; dealCount: number }[];

  totalDeals: number;
  pipelineValue: number;          // converted sum of estimatedValue
  weightedPipeline: number;       // sum(estimatedValue_converted * stage.weightPercent / 100)
  unweightedStageDealCount: number; // deals in a stage with weightPercent = null
  closedWonCount: number;
  winRatePercent: number;         // won / (won + lost) -- confirm this denominator choice once live, see below
  avgGrossProfitPercent: number;  // same-currency ratio, no conversion needed

  stageBreakdown: { mainStageId: string; mainStageName: string; position: number; weightPercent: number | null; dealCount: number; pipelineValue: number }[];
  sourceBreakdown: { sourceId: string | null; sourceName: string; dealCount: number }[];
  departmentBreakdown: { departmentId: string | null; departmentName: string; dealCount: number; winRatePercent: number }[];
  partnerBreakdown: { kind: "company" | "contact"; partnerId: string; partnerName: string; dealCount: number; pipelineValue: number; weightedValue: number }[];
}
```

New `DealsDashboardService` (`backend/src/modules/deals/deals-dashboard.service.ts`), built off
`DealsRepository.queryBuilderScoped("deal")` (free tenant-scoping), joined to `main_stages` and
using `FxRatesService.getRate()`/`convert()` for the currency math. `avgGrossProfitPercent` must
reuse the **exact** margin formula `frontend/src/lib/deals/deal-display.ts`'s
`computeCosting()` already uses client-side — translate it to SQL, don't re-derive a second
definition of GP%.

Partner breakdown extends `DealPartnersService` (`backend/src/modules/deals/deal-partners.service.ts`)
with a new `getPartnerPipelineBreakdown()` method, joining `deal_partners_map` the same way
`findAllLinksForTenant()` already does.

**Open question to confirm once this is live and the number is visible, not before**: win rate
as `won / (won + lost)` vs `won / total`. The former (current plan) excludes deals still in
flight (`Open`/`OnHold`) from the denominator; flagged as a judgment call worth a second look with
real data in front of you.

RBAC: reuse `PERMISSIONS.DEALS_VIEW`, no new permission key (this is a read view over Deal data,
same reasoning `GET /deals` already uses). Deep debug logging (entry/branch/result +
try/catch/rethrow) on every new controller/service method, per this repo's standing rule.
Update `_bmad-output/2-current-work/api-endpoint-registry.md` with the new endpoint in the same
change — don't batch that as a follow-up.

**If this proves too big for one session**, split into 3a (KPIs + stage breakdown, since that
query is also literally the funnel breakdown) and 3b (source + department + partner breakdown —
structurally independent group-bys on the same base query).

---

### Phase 4 — Frontend page rebuild (not started)

Rewrite `frontend/src/app/[tenant]/(dashboard)/dashboard/page.tsx` to a thin server component
(session + department picker via the existing `listDepartmentsPicker`), handing off to a new
client component owning department-tab/currency-selector state, fetching `/deals/dashboard`
itself — mirrors `frontend/src/components/funnel/FunnelSourceTabs.tsx`'s existing
"server fetches static lookups, client owns interactive state" split (read that file for the
pattern, especially its tab-bar mechanics — worth generalizing rather than rebuilding).

New `frontend/src/components/dashboard/` directory: `PipelineDashboard.tsx` (state owner),
`DepartmentTabBar.tsx`, `DashboardCurrencySelect.tsx` (wraps the existing, already-reusable
`frontend/src/components/ui/CurrencySelect.tsx`), `KpiCardRow.tsx` (built on the existing
`StatCard.tsx`). New `getDealsDashboard()` in `frontend/src/lib/api/deals.ts`.

Fixed Tailwind grid layout — no drag/resize, no persisted layout. All new strings through `t()`/
`en.json`'s new `dashboard.*` namespace; all styling via `--color-crm-*` tokens from the start
(this is new UI, not a restyle-phase retrofit — see CLAUDE.md's i18n/design-system rules).

### Phase 5 — Remaining breakdown widgets (not started)

`DealSourceBreakdownWidget.tsx`, `DepartmentBreakdownWidget.tsx`,
`PartnerPipelineBreakdownWidget.tsx` — one per response section not yet covered by Phase 4's
minimum-viable page. Backend queries for these are already done in Phase 3 (or 3b if split) —
this phase is frontend-only.

---

## Practical notes for whoever continues this

- **Node/npm are not on this machine's host shell PATH** (neither bash nor PowerShell). Every
  build/typecheck/migration command in this session was run via
  `docker exec orelia-backend-1 sh -c "cd /app/backend && npm run <script>"` (container
  bind-mounts the repo at `/app`). If `common/src/` was touched, rebuild its gitignored `dist/`
  first (`docker exec orelia-backend-1 sh -c "cd /app/common && npm run build"`) or backend/
  frontend builds fail with a stale "no exported member" error that has nothing to do with your
  actual change.
- **This repo's working tree has other people's/sessions' unrelated work mixed in** — as of this
  handoff, `git status` also shows uncommitted changes to `deals.service.ts`, `deals.controller.ts`,
  `deal.entity.ts`, employee/tenant services, funnel/deal detail pages, and untracked
  `deal-roles*`/`deal-team*` files, none of which belong to this dashboard effort (they're
  follow-on work to the already-committed `7651670 feat(deals): add deal_roles/deal_role_assignments
  schema for team roles`). **Don't touch those files as part of continuing this plan, and don't
  assume a clean `git status` before starting Phase 3** — it won't be clean, and that's not this
  work's mess to clean up.
- **Nothing from Phase 1 or 2 is committed yet.** Exact file list if you want to stage just this
  work:
  ```
  .env.example
  backend/src/config/env.validation.ts
  backend/src/core/core.module.ts
  backend/src/core/fx-rates/
  backend/src/database/migrations/1784700000034-AddWeightPercentToMainStages.ts
  backend/src/database/migrations/1784700000036-CreateFxRates.ts
  backend/src/modules/deal-stages/dto/create-main-stage.dto.ts
  backend/src/modules/deal-stages/dto/update-main-stage.dto.ts
  backend/src/modules/deal-stages/entities/main-stage.entity.ts
  backend/src/modules/deal-stages/main-stages.controller.ts
  common/src/contracts/deal-stages.contracts.ts
  frontend/src/app/[tenant]/(dashboard)/admin/main-stages/_components/MainStageFormDialog.tsx
  frontend/src/app/[tenant]/(dashboard)/admin/main-stages/_components/MainStagesWidget.tsx
  ```
- **Migrations 1784700000034 and 1784700000036 are applied to this dev DB already** (ran during
  verification). A fresh clone/DB will need `npm run migration:run` before Phase 1/2 code works.
- Both phases were verified with an actual `docker restart` + boot-log check, not just
  `tsc --noEmit` — worth doing the same for Phase 3 given it's a real query against real data,
  not just types lining up.
