import { Column, Entity } from "typeorm";
import { AuditedTenantEntity } from "../../../core/tenant";

// Admin-extensible lookup for Deal "team" roles (Sales Person, Pre-Sales,
// PMO, and any custom role an admin adds inline from the deal's Team tab).
// Deliberately minimal otherwise -- no code/is_protected/is_active, since
// nothing in this build renames, deactivates, or deletes a role yet.
@Entity("deal_roles")
export class DealRole extends AuditedTenantEntity {
  @Column()
  name!: string;

  // True only for the seeded "Sales Person" role: a deal must have exactly
  // one primary (deal_role_assignments.isPrimary) assignee for this role,
  // enforced at deal-creation time. Every other role (Pre-Sales, PMO,
  // custom) is optional and has no primary requirement.
  @Column({ name: "requires_primary_on_create", default: false })
  requiresPrimaryOnCreate!: boolean;
}
