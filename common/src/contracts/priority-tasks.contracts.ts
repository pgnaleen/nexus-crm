import { PriorityTaskQuadrant, PriorityTaskStatus } from "../enums";

export interface CreatePriorityTaskRequest {
  title: string;
  notes?: string;
  quadrant: PriorityTaskQuadrant;
}

// Story 1.3 (Drag-and-drop reorder). `index` is 0-based, within the
// destination quadrant's list, after the task has been removed from
// wherever it previously sat -- the backend resequences ranks (1..N) for
// every task in whichever quadrant(s) are actually affected.
export interface MovePriorityTaskRequest {
  quadrant: PriorityTaskQuadrant;
  index: number;
}

// Story 1.4 (View task details). Notes is the only field this story lets
// the owner edit -- quadrant/status/progress each have their own story
// (1.3 drag-and-drop, 1.7 progress) as the place to change them.
export interface UpdatePriorityTaskRequest {
  notes?: string;
}

// Story 1.7 (Track delegation progress). Only 0/10/20/.../100 are valid --
// the backend rejects anything else (e.g. a direct API call bypassing the
// UI's 10%-step control). progress === 100 is the "ready to close" signal
// that sets up the archive flow (Story 1.10).
export interface UpdatePriorityTaskProgressRequest {
  progress: number;
}

export interface PriorityTaskResponse {
  id: string;
  title: string;
  notes: string | null;
  quadrant: PriorityTaskQuadrant;
  rank: number;
  status: PriorityTaskStatus;
  progress: number;
  ownerId: string;
  // Derived relative to whoever is asking: ownerId === viewer's own id. On
  // the bulk list endpoint this is always "owned" (that endpoint only ever
  // returns the caller's own tasks), but the single-task detail endpoint
  // can also return a task merely shared with the viewer (Story 1.5) --
  // sharing never changes ownerId, so ownerId-vs-viewer is what "received"
  // actually means, not createdBy-vs-ownerId (a task shared with someone
  // else is still fully "owned" by its real owner from the owner's own
  // point of view).
  ownership: "owned" | "received";
  createdAt: string;
  // Only resolved by GET /priority-tasks/:id (the detail view's "who created
  // this" history entry) -- undefined on the bulk list response, which
  // nothing displays a creator name from yet. Null if the creator's account
  // was later deleted (created_by is ON DELETE SET NULL).
  createdByName?: string | null;
}

// Story 1.5 (Share a Task).
export interface CreatePriorityTaskShareRequest {
  userId: string;
}

export interface PriorityTaskShareResponse {
  id: string;
  userId: string;
  displayName: string;
  createdAt: string;
}

// Story 1.6 (Delegate a Task) -- send-side. Reused by Story 1.8's
// re-delegate (a pending recipient passing it on instead of accepting).
export interface DelegatePriorityTaskRequest {
  userId: string;
}

// Story 1.8 (Incoming). One item shared or delegated to the caller. `kind`
// drives the UI: a delegated item can be accepted (pulled onto the board,
// ownership transfers) or re-delegated; a shared item is read-only. `fromName`
// is who shared it / who delegated it to me (the re-delegator on a re-deleg).
export interface IncomingTaskResponse {
  id: string;
  title: string;
  kind: "shared" | "delegated";
  fromName: string;
  status: PriorityTaskStatus;
  progress: number;
  createdAt: string;
}

// Story 1.8 -- accepting a delegated task: the acceptor picks which quadrant
// it lands in on their own board. Ownership transfers to them.
export interface AcceptPriorityTaskRequest {
  quadrant: PriorityTaskQuadrant;
}

// The delegator's own tracking card, live-joined to the real task's
// current title/status/progress -- never a frozen snapshot.
export interface PriorityTaskDelegationTrackerResponse {
  id: string;
  taskId: string;
  taskTitle: string;
  taskStatus: PriorityTaskStatus;
  taskProgress: number;
  delegatedToUserId: string;
  delegatedToName: string;
  rank: number;
  createdAt: string;
}
