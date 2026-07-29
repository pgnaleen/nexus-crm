// Epic 3, Story 3.1 -- the "step" a priority_task_flow row represents for the
// user_id it belongs to. Append-only: a new hop is always a new row, never an
// edit of an old one (see priority_task_flow's own schema note on why).
//
// No separate "redelegated" value: when a still-pending recipient passes a
// delegation on to someone else without accepting, the ORIGINAL delegator's
// `delegated` row has its `linked_user_id` updated in place to the new
// target -- it is not a new hop for the original delegator, and the pending
// recipient never had a row of their own to begin with (see the entity's own
// comment on how a pending delegation is represented). Matches the deliberate
// behaviour of today's `redelegate()`, which never creates a second tracker.
//
// No separate "restored" value either: restoring an archived task writes a
// plain `placed` row, exactly like a fresh placement -- there is nothing
// about "how it got there" that the live board/rank queries need to
// distinguish. ("Restored" still exists as its own kind in the
// PriorityTaskHistoryEntry contract -- that's a presentation label derived
// from audit_logs, a separate concern from this table's own vocabulary.)
export enum PriorityTaskFlowEventType {
  Placed = "placed",
  Delegated = "delegated",
  Accepted = "accepted",
  Completed = "completed",
  Archived = "archived",
}
