import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "../../users/entities/user.entity";
import { PriorityTask } from "./priority-task.entity";

// Epic 3, Story 3.3 -- a real per-task discussion thread, additive to the
// task's own `notes` field. Same bare-join-table shape/rationale as
// PriorityTaskShare: no tenant_id of its own (scoped via the parent task,
// already tenant-scoped).
//
// The author may edit or delete their own message (added after 3.3
// shipped). `updatedAt`/`deletedAt`/`deletedBy` are plain columns, NOT a
// TypeORM @DeleteDateColumn -- that decorator would make every plain
// repo.find() silently exclude deleted rows, which breaks the requirement
// that a deleted message stays in the thread as a visible tombstone rather
// than vanishing. `body` itself is never overwritten on delete (nothing is
// destroyed, matching this project's soft-delete-everywhere rule); only the
// API response layer masks it for a deleted message -- see
// priority-task-messages.controller.ts's toResponse.
@Entity("priority_task_messages")
@Index(["taskId", "seq"])
export class PriorityTaskMessage {
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

  // Per-task monotonic counter -- stable ordering independent of clock
  // skew, and the hook a future unread-count feature would need.
  @Column({ type: "int" })
  seq!: number;

  @Column({ type: "text" })
  body!: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "created_by", type: "uuid", nullable: true })
  createdBy?: string;

  @Column({ name: "updated_at", type: "timestamptz", nullable: true })
  updatedAt?: Date;

  @Column({ name: "deleted_at", type: "timestamptz", nullable: true })
  deletedAt?: Date;

  @Column({ name: "deleted_by", type: "uuid", nullable: true })
  deletedBy?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "deleted_by" })
  deletedByUser?: User;
}
