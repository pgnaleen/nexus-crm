# Priority Tracker Code Review (2026-07-24)

Part of the split bugs tracker — see [`../BUGS.md`](../BUGS.md) for the severity legend shared
across every file in this folder. Still open, all low severity, all pre-2026-07-28 rewrite (see
[`../epics/epic-5-realtime-flow.md`](../epics/epic-5-realtime-flow.md)).

- ⚪ Task detail-view lifecycle history is synthesized from the task row rather than read from
  `AuditLogService` — the create path does write the audit row correctly, only the read side
  bypasses it.
- ⚪ A user account linked to more than one non-deleted Employee record makes `GET /employees/me`
  return an arbitrary one — no `UNIQUE(userId)` constraint at the DB level.
- ⚪ `GET /employees/me` does two DB round-trips (could collapse to one relation-loaded query) — no
  correctness risk, just avoidable.
- ⚪ The board's optimistic drag-reorder is never reconciled with the server's authoritative ranks
  after a move — would silently drift if the server ever resequenced differently (the HIGH
  concurrent-write bug that could cause that has since been fixed).
- ⚪ Clicking a task card immediately after a drag may spuriously open the detail dialog — not
  confirmed reproducible from code alone, needs browser verification.
- ⚪ Two concurrent creates into the same *empty* quadrant can both land rank 1 (accepted trade-off
  of the "lock only, no unique constraint" concurrency choice for a personal single-user board).
- ⚪ `move()`'s lock-then-lock ordering across two quadrants is a latent deadlock surface once a
  task can be touched by two owners mid-handoff (delegation).
- ⚪ Shares to a since-disabled/soft-deleted user linger in the "shared with" list (`ON DELETE
  CASCADE` only fires on a hard delete).
- ⚪ Hardcoded `#fdf0ee` hover background on the unshare button, instead of a design token.
- ⚪ `ShareTaskDialog` can fire its `onShared` callback after being dismissed if the POST is still
  in flight when it closes.
