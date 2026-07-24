import { PriorityTaskQuadrant } from "@orelia/common";
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { User } from "../../users/entities/user.entity";
import { PriorityTask } from "./priority-task.entity";

// Story 1.6 (Delegate a Task) -- the delegator's own tracking card, living
// in their DELEGATE quadrant. Never a duplicate of the real task's content;
// the frontend renders title/status/progress by following `task`. Same
// bare-join-table shape as PriorityTaskShare: no tenant_id of its own
// (delegator_id is always the caller's own id; task_id is already
// tenant-scoped), no soft-delete -- a tracker is either present or removed.
@Entity("priority_task_delegation_trackers")
@Unique(["taskId", "delegatorId"])
export class PriorityTaskDelegationTracker {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "task_id", type: "uuid" })
  taskId!: string;

  @ManyToOne(() => PriorityTask, { onDelete: "CASCADE" })
  @JoinColumn({ name: "task_id" })
  task?: PriorityTask;

  @Column({ name: "delegator_id", type: "uuid" })
  delegatorId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "delegator_id" })
  delegator?: User;

  @Column({ type: "enum", enum: PriorityTaskQuadrant, default: PriorityTaskQuadrant.Delegate })
  quadrant!: PriorityTaskQuadrant;

  @Column()
  rank!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ name: "created_by", type: "uuid", nullable: true })
  createdBy?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by" })
  createdByUser?: User;
}
