import { PriorityTaskQuadrant } from "@orelia/common";

// Classic Eisenhower reading order: Urgent+Important, Not Urgent+Important
// (top row), Urgent+Not Important, Not Urgent+Not Important (bottom row).
export const QUADRANT_ORDER: PriorityTaskQuadrant[] = [
  PriorityTaskQuadrant.Do,
  PriorityTaskQuadrant.Decide,
  PriorityTaskQuadrant.Delegate,
  PriorityTaskQuadrant.Delete,
];

export const DEFAULT_QUADRANT: PriorityTaskQuadrant = PriorityTaskQuadrant.Do;
