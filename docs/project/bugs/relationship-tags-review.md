# Relationship Tags Tab Review (2026-07-31)

Part of the split bugs tracker — see [`../BUGS.md`](../BUGS.md) for the severity legend shared
across every file in this folder. Still open.

- 🟡 `RelationshipPartiesService.setActive()` loads an entity with relations (`company`,
  `company.territoryOwner`, `contact`) then `saveScoped()`s it — the exact TypeORM relations-save
  anti-pattern documented in `CLAUDE.md`. Pre-existing (not introduced by the Tags Tab feature);
  no observed corruption yet, but worth a focused audit + the same bare-load-then-save split
  already applied to `deals.service.ts`.
- 🟡 `RelationshipHubDiagram`'s hub-and-spoke layout has a fixed radius/node size and doesn't
  reflow — a party tagged under 6+ relationship types shows visibly overlapping spoke nodes.
  Accepted for v1 since relationship types are a typically-small admin-curated list.
- 🟡 Add-tag pickers (relationship-type options) are fetched once on dialog mount and never
  refreshed. Low-probability window, but the *same* staleness pattern on the Industries picker was
  the realistic trigger for a real silent-data-loss bug (see `../DECISIONS.md`) — the general lesson
  (a stale picker option is only harmless if every write path it feeds validates + is atomic)
  still applies wherever this hasn't been checked.
- 🟡 `handleAddTag`'s catch block only routes the 409 case through `t()`; every other `ApiError`
  shows the raw backend English message verbatim (pre-existing pattern, not new).
- 🟡 The tag-list fetch and the relationship-type-picker fetch share one `tagError` state — if both
  fail near-simultaneously, whichever settles last silently overwrites the other's message.
- ⚪ `RelationshipHubDiagram` isn't accessible to screen readers beyond the center label — no
  documented project a11y standard was violated, but it's a real gap.
