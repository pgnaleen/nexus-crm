import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { Industry } from "../../tenants/entities/industry.entity";
import { User } from "../../users/entities/user.entity";
import { Company } from "./company.entity";

// A bare join table, same shape and rationale as DealPartnersMap and
// PriorityTaskShare (see CLAUDE.md's "Exemption -- pure join/link tables"):
// it associates two already-audited rows and carries no state of its own, so
// it does not extend AuditedTenantEntity and has no soft-delete. A link is
// either present or hard-removed, never "updated". No tenant_id column --
// scope is inherited through the already-tenant-scoped Company.
//
// It still records createdBy, and both linking and unlinking still write an
// audit_logs row (emitted by RelationshipPartiesService), so the actor trail
// survives even though the row itself can vanish.
@Entity("company_industries")
@Unique(["companyId", "industryId"])
export class CompanyIndustry {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "company_id", type: "uuid" })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: "CASCADE" })
  @JoinColumn({ name: "company_id" })
  company?: Company;

  @Column({ name: "industry_id", type: "uuid" })
  industryId!: string;

  // RESTRICT, not CASCADE: industries is a small curated lookup, and silently
  // dropping every company's tag because someone deleted an industry row is
  // exactly the "cascade that loses real data" failure CLAUDE.md warns about.
  @ManyToOne(() => Industry, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "industry_id" })
  industry?: Industry;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ name: "created_by", type: "uuid", nullable: true })
  createdBy?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by" })
  createdByUser?: User;
}
