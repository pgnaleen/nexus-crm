import { Column, Entity } from "typeorm";
import { AuditedTenantEntity } from "../../../core/tenant";

// Epic 3, Story 3.2 -- slimmed to pure identity. Ownership, quadrant, rank,
// status, and delegation state used to live as mutable columns here; they
// now live entirely in priority_task_flow (see that entity's own comment),
// because a single mutable owner_id/quadrant/status shared across every
// perspective on a task is exactly what let a stale delegation tracker go
// undetected -- nothing on this row itself changed to signal it. `notes`
// is still owned by whoever the CURRENT holder is (resolved via flow), same
// edit rule as before (Story 1.4).
@Entity("priority_tasks")
export class PriorityTask extends AuditedTenantEntity {
  @Column()
  title!: string;

  @Column({ type: "text", nullable: true })
  notes?: string;
}
