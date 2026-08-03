# Story: Funnel Main Stage Progress Indicator

Status: done

No numbered epic — Funnel/Deals feature work in this repo lives in `4-design-plans/` design docs,
not epics-and-stories. Tracked here as a standalone story per the `2-current-work` story-location
convention.

## Story

As a **sales manager viewing the Funnel board**,
I want **to see each Main Stage's configured progress weight, both on the column and on individual
deal cards**,
so that **I can gauge how far along the pipeline deals are without opening each one**.

## Background

`main_stages.weight_percent` (0-100, nullable) already exists end-to-end — entity, DTO validation,
contract, admin form (`MainStageFormDialog.tsx`), admin list (`MainStagesWidget.tsx`) — shipped in
commit `fe9f158` for a "Weighted Pipeline" dashboard KPI that was never built. `GET /main-stages`
already returns it today. This story reuses that same field for a second consumer (the Funnel
board) — **no backend or migration work**, pure frontend threading + display.

## Acceptance Criteria

1. **AC1 — Column header badge.** On the Funnel overview board, each Main Stage column's header
   shows a `<weightPercent>%` badge next to the existing deal-count pill, styled consistently with
   it (same `bg`/`accent`). A stage with no weight set shows no badge at all — never `0%`.
2. **AC2 — Per-deal-card progress bar.** Every deal card (full variant, not compact) shows a thin
   filled bar reflecting its current Main Stage's weight — width = `weightPercent%`, filled in the
   card's own existing per-column accent color (not brand red — this board's colors are already
   per-column, non-red). No bar when the stage has no weight set.
3. **AC3 — Per-Main-Stage board parity.** On a per-Main-Stage board (`/deals/[id]`, columns = Sub
   Stages of one Main Stage), every column shows that one Main Stage's badge (identical across
   columns — there is no per-Sub-Stage weight), and cards show the matching bar.
4. **AC4 — Compact mode unaffected.** Compact card mode (name + value only) renders unchanged, no
   bar added there.

## Tasks / Subtasks

- [ ] Task 1 — Type plumbing (AC: 1, 2, 3)
  - [ ] `common/src/types/deal.types.ts`: add `weightPercent: number | null` to `IMainStage`,
    alongside `isWon`/`isLost` (every other real column lives there; this one was a gap from when
    it was added just for the admin screens)
  - [ ] `common/src/contracts/deal-stages.contracts.ts`: remove the now-redundant duplicate
    `weightPercent: number | null` declaration on `MainStageResponse` — inherited from `IMainStage`
  - [ ] Rebuild common in Docker: `docker compose exec backend pnpm --filter @orelia/common build`
    (not watched — stale build shows as a TS2305/TS2551 error in backend/frontend)
- [ ] Task 2 — Stop dropping it at the page level (AC: 1, 2, 3)
  - [ ] `frontend/src/app/[tenant]/(dashboard)/funnel/page.tsx`: add
    `weightPercent: stage.weightPercent` to both the `columns` map and the `mainStages` map
  - [ ] `frontend/src/app/[tenant]/(dashboard)/deals/[id]/page.tsx`: add
    `weightPercent: mainStage.weightPercent` to every Sub-Stage `columns` entry — the single
    enclosing Main Stage's value, repeated across all its Sub-Stage columns (deliberate, see AC3)
- [ ] Task 3 — `FunnelColumn` + `KanbanColumn` (AC: 1)
  - [ ] `frontend/src/components/funnel/FunnelBoard.tsx`: add `weightPercent?: number | null` to
    the `FunnelColumn` interface
  - [ ] `KanbanColumn`: accept the new prop, render the `%` badge next to the count pill
    (conditionally — only when `weightPercent` is a number)
  - [ ] Pass `weightPercent={column.weightPercent}` from the main `FunnelBoard` render loop
- [ ] Task 4 — `DealCard` progress bar (AC: 2, 4)
  - [ ] Thread `weightPercent` from `KanbanColumn`'s per-card loop into `DealCard` as a new prop
  - [ ] Render a thin filled bar in the full-card variant only, fill color = the card's existing
    `accent` prop, width = `weightPercent%`; omit entirely when null/undefined
  - [ ] Leave the compact variant untouched
- [ ] Task 5 — Verification (no test infra exists for this area — manual only)
  - [ ] `docker compose exec backend sh -c "cd /app/backend && pnpm exec tsc --noEmit"` and the
    frontend equivalent — no NEW errors (pre-existing unrelated errors in
    RolePermissionsDialog/TenantFormDialog/UserFormDialog/RoleCardPicker are not yours, don't fix)
  - [ ] Set Weight % on a couple of Main Stages via the existing admin screen
  - [ ] Funnel overview board: confirm badge + bar appear correctly, and a stage with no weight
    set shows neither
  - [ ] Per-Main-Stage board (`/deals/[id]`): confirm every Sub-Stage column shows the same badge
    value and matching bar
  - [ ] Compact mode: confirm no bar, no layout regression

## Dev Notes

- No backend change at all — `GET /main-stages` (`main-stages.controller.ts`) already returns
  `weightPercent`; this is purely `common` type plumbing + two frontend files.
- Column colors in `FunnelBoard.tsx` come from `colorForIndex()` (a fixed positional palette), not
  from any stage property — the bar/badge don't introduce a new color, they reuse the same
  `accent`/`bg` already computed per column and already passed into both `KanbanColumn` and
  `DealCard`.
- `MainStageResponse extends IMainStage` — once `weightPercent` moves onto `IMainStage`, the
  duplicate line on `MainStageResponse` becomes a harmless-but-redundant re-declaration; remove it
  for tidiness, not because leaving it would break anything.
