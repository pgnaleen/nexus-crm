import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { User } from "../../users/entities/user.entity";
import { PriorityTask } from "./priority-task.entity";

// Story 1.5 (Share a Task) -- a bare join table, same shape/rationale as
// DealPartnersMap: no tenant_id of its own (scoped via the parent task,
// which is already tenant-scoped), no soft-delete (a share is either
// present or hard-removed via its own "unshare" action, never "updated").
@Entity("priority_task_shares")
@Unique(["taskId", "sharedWithUserId"])
export class PriorityTaskShare {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "task_id", type: "uuid" })
  taskId!: string;

  @ManyToOne(() => PriorityTask, { onDelete: "CASCADE" })
  @JoinColumn({ name: "task_id" })
  task?: PriorityTask;

  @Column({ name: "shared_with_user_id", type: "uuid" })
  sharedWithUserId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "shared_with_user_id" })
  sharedWithUser?: User;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ name: "created_by", type: "uuid", nullable: true })
  createdBy?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by" })
  createdByUser?: User;
}
