---
title: 'Deal dialog tabs render on a single row'
type: 'bugfix'
created: '2026-07-28'
status: 'done'
route: 'one-shot'
---

# Deal dialog tabs render on a single row

## Intent

**Problem:** In the funnel's View Deal dialog the 8 tabs no longer fit the 720px dialog width, and `flex-wrap` pushed the last tab — **History** — onto its own second row, so the tab strip read as two rows instead of one. The Add/Edit Deal dialog carried the same crowding on its own 8-tab strip, manifesting as squashed labels rather than a wrap because it lacked `flex-wrap`.

**Approach:** Make both deal tab strips explicitly single-row: `flex-nowrap` so nothing wraps, `shrink-0` + `whitespace-nowrap` on each tab so labels keep their natural width instead of squashing, `gap-x-4` (16px) replacing the per-button `mr-[22px]` to reclaim the ~50px needed for all 8 tabs to fit, and `overflow-x-auto` as a graceful fallback (narrow viewports, or a long `Documents (N)` label) so the strip scrolls horizontally rather than ever wrapping again.

## Suggested Review Order

1. [`ViewDealDialog.tsx:187-205`](../../frontend/src/components/funnel/ViewDealDialog.tsx#L187-L205) — the reported bug: `flex flex-wrap` → `flex flex-nowrap gap-x-4 overflow-x-auto`, buttons gain `shrink-0 whitespace-nowrap` and drop `mr-[22px]`.
2. [`AddDealDialog.tsx:859-877`](../../frontend/src/components/funnel/AddDealDialog.tsx#L859-L877) — same treatment applied to the sibling strip, so both deal dialogs stay visually identical.
3. [`ViewDealDialog.tsx:28-37`](../../frontend/src/components/funnel/ViewDealDialog.tsx#L28-L37) — the 8-entry `TABS` list, for the width budget behind the `gap-x-4` choice.
