import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "../../users/entities/user.entity";
import { PriorityTask } from "./priority-task.entity";

// Epic 3, Story 3.3 -- a real per-task discussion thread, additive to the
// task's own `notes` field. Same bare-join-table shape/rationale as
// PriorityTaskShare: no tenant_id of its own (scoped via the parent task,
// already tenant-scoped), no soft-delete. Unlike a share, a message is also
// never "updated" -- immutable once sent, no edit/delete in this pass.
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
}
