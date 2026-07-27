import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

export type AuditAction = "insert" | "update" | "delete";

/**
 * A separate, append-only audit trail beyond the per-row createdBy/updatedBy/
 * deletedBy (which only ever show the *last* actor) -- see CLAUDE.md's
 * "Deeper audit trail" rule. Not a soft-deletable entity itself: an audit
 * log entry is never edited or removed once written.
 */
@Entity("audit_logs")
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  // Nullable -- some actions (e.g. platform-level Tenant management) aren't
  // scoped to a single tenant the way ordinary business records are.
  @Column({ type: "uuid", nullable: true })
  tenantId?: string;

  @Column()
  entityType!: string;

  @Column({ type: "uuid" })
  entityId!: string;

  @Column({ type: "enum", enum: ["insert", "update", "delete"] })
  action!: AuditAction;

  @Column({ type: "uuid", nullable: true })
  actorId?: string;

  @CreateDateColumn({ type: "timestamptz" })
  occurredAt!: Date;

  // Field-level { field: { old, new } } diffs for updates; a full snapshot
  // for insert/delete. Left as unknown at this layer -- callers own the
  // shape of what they choose to record.
  @Column({ type: "jsonb", nullable: true })
  changes?: Record<string, unknown>;
}
