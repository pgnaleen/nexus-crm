import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Deal } from "./deal.entity";
import { DealRole } from "./deal-role.entity";

// Bare join table, same shape/rationale as DealPartnersMap: no tenant_id of
// its own (scoped transitively via deal_id, which is already tenant-scoped),
// no soft-delete -- an assignment is either present or hard-removed via its
// own "unassign" action, never "updated". Keyed on userId (not employeeId):
// assignment is about the logged-in User doing the work, and Employee has
// only an optional, one-directional link to User (employees.user_id), so
// keying on Employee would silently exclude any user with no HR record.
@Entity("deal_role_assignments")
@Unique(["dealId", "roleId", "userId"])
export class DealRoleAssignment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  dealId!: string;

  @ManyToOne(() => Deal, { onDelete: "CASCADE" })
  @JoinColumn({ name: "deal_id" })
  deal?: Deal;

  @Column({ type: "uuid" })
  roleId!: string;

  @ManyToOne(() => DealRole, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "role_id" })
  role?: DealRole;

  @Column({ type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "user_id" })
  user?: User;

  // Meaningful only for roles with requiresPrimaryOnCreate=true (today, just
  // Sales Person) -- a partial unique index (deal_id, role_id) WHERE
  // is_primary enforces at most one primary per role per deal at the DB
  // level, not just in application code.
  @Column({ name: "is_primary", default: false })
  isPrimary!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "created_by", type: "uuid", nullable: true })
  createdById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by" })
  createdByUser?: User;
}
