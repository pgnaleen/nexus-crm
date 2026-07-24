import { PriorityTaskQuadrant, PriorityTaskStatus } from "@orelia/common";
import { Column, Entity } from "typeorm";
import { AuditedTenantEntity } from "../../../core/tenant";

// Story 1.1/1.2 columns only. `createdBy` (from AuditedTenantEntity) is the
// task's creator and never changes; `ownerId` is the current owner and is
// the one that will move once Story 1.6 (Delegate) exists -- see the
// migration's own comment for why there's no separate creator_id column.
@Entity("priority_tasks")
export class PriorityTask extends AuditedTenantEntity {
  @Column({ name: "owner_id", type: "uuid" })
  ownerId!: string;

  @Column()
  title!: string;

  @Column({ type: "text", nullable: true })
  notes?: string;

  @Column({ type: "enum", enum: PriorityTaskQuadrant })
  quadrant!: PriorityTaskQuadrant;

  @Column()
  rank!: number;

  @Column({ type: "enum", enum: PriorityTaskStatus, default: PriorityTaskStatus.Placed })
  status!: PriorityTaskStatus;

  @Column({ default: 0 })
  progress!: number;

  // Story 1.6 -- set the moment this task is delegated, cleared back to
  // undefined once Story 1.8's accept flow transfers ownerId to whoever
  // this points at. Non-null here is the source-of-truth pending signal;
  // `status: Delegated` is just its human-readable mirror.
  @Column({ name: "delegated_to_user_id", type: "uuid", nullable: true })
  delegatedToUserId?: string;
}
