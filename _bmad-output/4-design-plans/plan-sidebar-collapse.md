# Sidebar collapse — manual icon-only toggle + auto-collapse on narrow screens

## Context

Split out of the Phase 6 responsive pass as its own deliberate feature (real interaction/state
design, not a CSS patch). Two behaviors, confirmed with the user:
1. A manual toggle that shrinks the sidebar to an icon-only rail, remembered across visits.
2. Auto-collapse to that same icon-only rail once the window gets narrow — no hamburger/overlay,
   same visual state as the manual toggle.

All of this is self-contained inside `frontend/src/components/layout/Sidebar.tsx` — it already owns
its own fixed width (`w-[250px]`, `Sidebar.tsx:117`) as a client component sitting inside a plain
flex row in `frontend/src/app/[tenant]/(dashboard)/layout.tsx` (`min-w-0 flex-1` on the content
side). Shrinking the nav's own width is enough for the content column to reclaim the space —
**`layout.tsx` needs zero changes.**

## Behavior spec (resolves the "remember it" + "always reachable" tension)

- `collapsed = manualOverride !== null ? manualOverride : isNarrow` — manual choice, once made,
  always wins over screen width; before any manual choice exists, it purely follows screen width.
- `isNarrow`: live, via a `resize` listener, `window.innerWidth < 1024` (Tailwind's `lg`).
- `manualOverride`: `null` until the user does an explicit collapse-affecting action; once set,
  persisted to `localStorage` (`orelia-sidebar-collapsed`) and read back on mount — this is what
  makes the choice "remembered."
- Two things count as an explicit action: (a) clicking the dedicated toggle button, (b) clicking a
  group's icon (Deals/Relationships/HR/Config/Admin) while collapsed — this sets
  `manualOverride = false` (expand) and opens that group, so its sub-items (which have no icons of
  their own) stay reachable even on a genuinely narrow screen, instead of becoming permanently
  unreachable. Without this, `isNarrow` alone could otherwise lock a user out of any nested page.
- Known, accepted trade-off: like the existing `isNavigating` state in this same file, this is
  client-only state — there's a brief flash from the default (expanded) to the correct
  collapsed/expanded state on first paint for returning users or narrow screens. Not worth adding
  cookie-based SSR just to avoid it.

## Implementation — all in `Sidebar.tsx`

1. New state: `manualOverride` (`boolean | null`), `isNarrow` (`boolean`). One `useEffect` on mount
   reads `localStorage`, sets up the `resize` listener (cleaned up on unmount) — same shape as the
   existing `useEffect` at `Sidebar.tsx:75-77`.
2. `<nav>` (`Sidebar.tsx:117`): width becomes `collapsed ? "w-[72px]" : "w-[250px]"`, plus
   `overflow-x-hidden` and a `transition-[width] duration-200` (reusing the exact transition
   pattern already on `TopBar.tsx`'s search box) so it animates instead of snapping.
3. Logo row (`Sidebar.tsx:118-120`): pass `iconOnly={collapsed}` to `OreliaLogo` — this prop
   **already exists** (`OreliaLogo.tsx`, ring+dot mark with no wordmark), just unused today. Add
   the toggle button here: a small icon button reusing the existing `ChevronRightIcon`, rotated via
   the same `chevronClasses`-style rotate trick already used for the group chevrons
   (`Sidebar.tsx:41-43`) — no new icon component needed.
4. The 3 top-level `<Link>`s (Dashboard/Priority Tracker/Funnel) and 5 group `<button>` toggles:
   each gets `title={label}` for a native tooltip when collapsed (same lightweight pattern already
   used at `TenantsTableWidget.tsx:214` — no new tooltip component), and its label
   text wrapped so it only renders when `!collapsed`. Kept as the same hand-written per-item JSX
   blocks this file already uses (it never abstracted nav items into a shared component/config
   map for anything but the sub-item `.map()`s) — matches this project's established "no
   abstraction until it's actually needed" pattern rather than introducing a new `NavItem`
   component for 8 call sites.
5. The 5 group toggle `onClick` handlers change from `setIsXOpen((c) => !c)` to a shared branch:
   if `collapsed`, set `manualOverride` to `false` (persisting) and force that group's own open
   state to `true`; otherwise toggle as today. The chevron span only renders when `!collapsed`.
6. The 5 sub-item list blocks (`{isDealsOpen && (...)}` etc.) each gain a `!collapsed &&` guard so
   nothing tries to render indented text sub-links inside a 72px rail.

## Explicitly not doing
- No hamburger/overlay drawer — confirmed, narrow screens get the same icon-only rail as the
  manual toggle, not a temporary overlay panel.
- No new shared `NavItem` component — matches this project's file-by-file, minimal-abstraction
  precedent (same reasoning as the Phase 6 "patch in place, no shared FilterBar" decision).
- No cookie/SSR-synced collapse state — client-only `localStorage`, accepting the brief first-paint
  flash as already-precedented in this file.

## Verification
No browser automation tool is available in this environment. Verified by (a)
`pnpm --filter @orelia/frontend run typecheck` staying at the same pre-existing baseline, and (b)
asking the user to manually: toggle collapse/expand and reload to confirm it's remembered; resize
the window below/above ~1024px to confirm auto-collapse/expand; click a group icon while collapsed
on a narrow window to confirm it expands and reveals that group's sub-items.
