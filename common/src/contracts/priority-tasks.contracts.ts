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

export interface PriorityTaskResponse {
  id: string;
  title: string;
  notes: string | null;
  quadrant: PriorityTaskQuadrant;
  rank: number;
  status: PriorityTaskStatus;
  progress: number;
  ownerId: string;
  // Derived: createdBy === ownerId -- "received" only becomes possible once
  // Story 1.5 (Share)/1.6 (Delegate) exist and can move ownerId away from
  // whoever originally created the task.
  ownership: "owned" | "received";
  createdAt: string;
  // Only resolved by GET /priority-tasks/:id (the detail view's "who created
  // this" history entry) -- undefined on the bulk list response, which
  // nothing displays a creator name from yet. Null if the creator's account
  // was later deleted (created_by is ON DELETE SET NULL).
  createdByName?: string | null;
}
