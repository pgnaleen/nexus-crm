import { PriorityTaskFlowEventType, PriorityTaskQuadrant } from "@orelia/common";
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "../../users/entities/user.entity";
import { PriorityTask } from "./priority-task.entity";

// Epic 3, Story 3.1 -- the single append-only source of truth for who holds
// a task, what step it's on, and where it sits on their board. Replaces
// priority_tasks' own owner_id/quadrant/rank/status/delegated_*_user_id
// columns and the whole priority_task_delegation_trackers table.
//
// A user's board = rows where user_id = me, is_current, event_type IN
// (placed, accepted). A user's DELEGATE tracking cards = rows where
// user_id = me, is_current, event_type = delegated. A pending delegation TO
// me is found via linked_user_id = me on someone else's current `delegated`
// row -- there is no separate row for the pending recipient themselves.
//
// The invariant that makes the old stale-tracker bug structurally
// impossible: at most one is_current row per (task_id, user_id), enforced by
// a partial unique index in the migration (TypeORM has no column-level way
// to express a WHERE-qualified unique index, so it's added as raw DDL
// there, not a decorator here). Every write that gives a user a new row for
// a task must flip their previous current row to false in the same
// transaction -- see Story 3.2.
@Entity("priority_task_flow")
@Index(["taskId", "userId"])
@Index(["linkedUserId"])
export class PriorityTaskFlow {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "task_id", type: "uuid" })
  taskId!: string;

  @ManyToOne(() => PriorityTask, { onDelete: "CASCADE" })
  @JoinColumn({ name: "task_id" })
  task?: PriorityTask;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user?: User;

  // Per-task monotonic hop counter (1, 2, 3, ...) -- what "which step is
  // this task on" resolves to. Only a real hop (placed/delegated/accepted/
  // completed/archived/restored) increments it; a same-quadrant drag-reorder
  // or a progress update mutates the current row in place instead (see
  // quadrant/rank/progress below), because neither is a step in the task's
  // custody, just a position/state tweak on the step already in progress.
  @Column({ type: "int" })
  seq!: number;

  @Column({ name: "event_type", type: "enum", enum: PriorityTaskFlowEventType })
  eventType!: PriorityTaskFlowEventType;

  // The other party: who a `delegated` row was sent to, or who an
  // `accepted` row's task came from. Null for placed/completed/archived/
  // restored, which have no second party.
  @Column({ name: "linked_user_id", type: "uuid", nullable: true })
  linkedUserId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "linked_user_id" })
  linkedUser?: User;

  // Mutable in place on the current row only -- see the seq comment above.
  @Column({ type: "enum", enum: PriorityTaskQuadrant, nullable: true })
  quadrant?: PriorityTaskQuadrant;

  @Column({ type: "int", nullable: true })
  rank?: number;

  @Column({ type: "int", default: 0 })
  progress!: number;

  // Exactly one true per (task_id, user_id) -- see the partial unique index
  // added in the migration and the class-level comment above.
  @Column({ name: "is_current", type: "boolean", default: true })
  isCurrent!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "created_by", type: "uuid", nullable: true })
  createdBy?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by" })
  createdByUser?: User;
}
