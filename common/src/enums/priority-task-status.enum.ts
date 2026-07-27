// Accepted/InProgress/Completed/Archived get added here, each via its own
// migration, as Stories 1.7-1.10 are built. "Shared" (1.5) never became a
// status value -- sharing is pure visibility (priority_task_shares), it
// never changes the task's own lifecycle stage.
export enum PriorityTaskStatus {
  Placed = "placed",
  // Story 1.6 -- set the moment a task is delegated, cleared back off once
  // Story 1.8's accept flow transfers ownership (delegatedToUserId is the
  // pending-vs-accepted signal; this status is the human-readable mirror
  // of "delegatedToUserId is currently set").
  Delegated = "delegated",
  // Story 1.8 -- set when a delegated task is accepted: ownership has
  // transferred to the acceptor and it now sits on their own board.
  Accepted = "accepted",
  // Story 1.9 -- the owner has marked the work done; a Completed task is the
  // one thing Story 1.10's archive flow will accept.
  Completed = "completed",
  // Story 1.10 -- archived off the active board (restorable).
  Archived = "archived",
}
