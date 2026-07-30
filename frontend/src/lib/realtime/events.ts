import type { PriorityTaskMessageResponse } from "@orelia/common";

// Mirrors backend/src/core/realtime/realtime.constants.ts's event names --
// no shared package between the two processes for these, so keep both in
// sync by hand if either changes.
export const PRIORITY_TASK_FLOW_CHANGED_EVENT = "priority-task:flow-changed";

export interface PriorityTaskFlowChangedPayload {
  taskId: string;
}

export const PRIORITY_TASK_MESSAGE_EVENT = "priority-task:message";

export interface PriorityTaskMessagePayload {
  taskId: string;
  kind: "created" | "edited" | "deleted";
  message: PriorityTaskMessageResponse;
}
