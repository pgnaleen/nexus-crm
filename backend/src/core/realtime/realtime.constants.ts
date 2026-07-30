// Epic 3, Story 3.4 -- the app's first WebSocket infrastructure. One room
// per (tenant, user) pair -- everything this gateway ever emits is scoped to
// "this specific person's own view", never broadcast tenant-wide, so a room
// per connected user is the right granularity (not per-tenant, not global).
export function tenantUserRoom(tenantId: string, userId: string): string {
  return `tenant:${tenantId}:user:${userId}`;
}

// Payload is deliberately just the id -- the client already knows how to
// re-fetch a task/the board/Incoming; this is a "something changed, go look"
// signal, not a snapshot to trust and render directly (avoids ever getting
// out of sync with the real access-control/derivation logic those GET
// endpoints already enforce).
export const PRIORITY_TASK_FLOW_CHANGED_EVENT = "priority-task:flow-changed";
export interface PriorityTaskFlowChangedPayload {
  taskId: string;
}

// Epic 3, Story 3.5. Unlike flow-changed, this carries the real message --
// a chat message is small, has no access-control re-derivation the way task
// state does, so pushing the content directly (rather than another
// "go re-fetch" signal) is safe and lower-latency. `kind` distinguishes a
// brand-new message from an edit or a delete of an existing one -- same
// event name for all three, since each is just "here is the current true
// state of one message"; the frontend upserts by `message.id` rather than
// always appending.
export const PRIORITY_TASK_MESSAGE_EVENT = "priority-task:message";
export interface PriorityTaskMessagePayload {
  taskId: string;
  kind: "created" | "edited" | "deleted";
  message: {
    id: string;
    userId: string;
    authorName: string;
    body: string;
    createdAt: string;
    editedAt: string | null;
    isDeleted: boolean;
  };
}
