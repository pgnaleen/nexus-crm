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
  // Story 2.3 -- drives the card's "Mine" vs "Assigned to me" pill.
  // `ownership` can't answer this: it's ownerId-vs-viewer, so a task I
  // created AND a task I accepted from someone else are both "owned". This
  // is createdBy-vs-viewer, the orthogonal axis -- true only if I'm the one
  // who originally made it.
  isCreator: boolean;
  // Story 2.4 -- may this viewer actually change the task (notes, progress,
  // shares, complete, archive)? Deliberately NOT the same as
  // `ownership === "owned"`: while a delegation is pending, the delegator is
  // still `ownerId` (ownership only transfers on accept) but has handed the
  // work off, so they are a tracker, not an actor. `ownership` answers "whose
  // record is this", this answers "whose turn is it".
  canEdit: boolean;
  // Story 2.3 -- how many people I've shared this task with, driving the
  // card's "Shared" pill without a second round-trip per card. Always 0 for
  // a viewer who isn't the owner (only an owner can share -- Story 1.5).
  shareCount: number;
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
  // Story 2.9 -- the drawer shows a short notes preview so an item can be
  // triaged without opening it. Sent in full and truncated for display: the
  // recipient can open the task and read all of it anyway (they're either the
  // pending delegate or a share recipient), so a server-side truncation would
  // buy nothing and hard-code a UI decision into the contract.
  notes: string | null;
}

// Story 1.8 -- accepting a delegated task: the acceptor picks which quadrant
// it lands in on their own board. Ownership transfers to them.
export interface AcceptPriorityTaskRequest {
  quadrant: PriorityTaskQuadrant;
}

// Story 1.9 -- one entry in a task's lifecycle history, derived from the
// existing audit_logs trail (not a bespoke table). `kind` is structured so
// the frontend renders the label via i18n; `detail` carries the one variable
// bit (a progress %, or the target's name on a delegate/re-delegate).
export interface PriorityTaskHistoryEntry {
  kind: "created" | "delegated" | "redelegated" | "accepted" | "progress" | "completed" | "archived" | "restored";
  actorName: string | null;
  detail: string | null;
  timestamp: string;
}

// Epic 3, Story 3.3 (Task Chat). Additive to `notes` -- a real per-task
// message thread, never a replacement for the owner's own free-text field.
// Messages are immutable once sent (no edit/delete in this pass).
export interface CreatePriorityTaskMessageRequest {
  body: string;
}

export interface PriorityTaskMessageResponse {
  id: string;
  userId: string;
  authorName: string;
  body: string;
  createdAt: string;
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
