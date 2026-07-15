import { TenantStatus } from "@orelia/common";
import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { AuditedEntity } from "../../../core/audited.entity";
import { Industry } from "./industry.entity";
import { Plan } from "./plan.entity";

@Entity("tenants_registry")
export class Tenant extends AuditedEntity {
  @Column()
  name!: string;

  @Column({ unique: true })
  slug!: string;

  @Column({ nullable: true })
  tagline?: string;

  @Column({ type: "uuid" })
  planId!: string;

  @ManyToOne(() => Plan)
  @JoinColumn({ name: "plan_id" })
  plan?: Plan;

  @Column({ type: "enum", enum: TenantStatus, default: TenantStatus.Trial })
  status!: TenantStatus;

  @Column({ type: "uuid", nullable: true })
  industryId?: string;

  @ManyToOne(() => Industry, { nullable: true })
  @JoinColumn({ name: "industry_id" })
  industry?: Industry;

  @Column({ nullable: true })
  phoneNo?: string;

  @Column({ nullable: true })
  contactEmail?: string;

  @Column({ nullable: true })
  billingEmail?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ type: "date", nullable: true })
  trialEnds?: string;

  @Column({ type: "text", nullable: true })
  notes?: string;

  @Column({ type: "text", nullable: true })
  extras?: string;

  @Column({ nullable: true })
  asset?: string;
}
