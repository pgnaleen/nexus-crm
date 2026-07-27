import { DealStatus, DealType } from "@orelia/common";
import { Check, Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { AuditedTenantEntity } from "../../../core/tenant";
import { Company } from "../../companies/entities/company.entity";
import { Contact } from "../../contacts/entities/contact.entity";
import { DealSource } from "../../deal-sources/entities/deal-source.entity";
import { MainStage } from "../../deal-stages/entities/main-stage.entity";
import { SubStage } from "../../deal-stages/entities/sub-stage.entity";
import { Department } from "../../departments/entities/department.entity";
import { Employee } from "../../employees/entities/employee.entity";

export interface CompetitorEntry {
  name: string;
  details: string;
}

@Entity("deals")
@Check(`("company_id" IS NOT NULL) OR ("contact_id" IS NOT NULL)`)
export class Deal extends AuditedTenantEntity {
  @Column()
  dealCode!: string;

  @Column()
  name!: string;

  @Column({ type: "enum", enum: DealType })
  dealType!: DealType;

  // Nullable -- the customer can be a bare contact with no company of its
  // own (contactId below carries that case). The CHECK on this entity
  // enforces that a deal always has one or the other.
  @Column({ type: "uuid", nullable: true })
  companyId?: string;

  @ManyToOne(() => Company, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "company_id" })
  company?: Company;

  @Column({ type: "uuid", nullable: true })
  primaryContactId?: string;

  @ManyToOne(() => Contact, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "primary_contact_id" })
  primaryContact?: Contact;

  @Column({ type: "uuid", nullable: true })
  contactId?: string;

  @ManyToOne(() => Contact, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "contact_id" })
  contact?: Contact;

  @Column({ type: "uuid", nullable: true })
  sourceId?: string;

  @ManyToOne(() => DealSource, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "source_id" })
  source?: DealSource;

  @Column({ type: "uuid" })
  ownerId!: string;

  // No onDelete action (defaults to RESTRICT-like NO ACTION) — ownerId is
  // required, so deleting an Employee who still owns deals must be blocked,
  // forcing reassignment first, rather than leaving a NOT NULL column with
  // nothing to reference.
  @ManyToOne(() => Employee)
  @JoinColumn({ name: "owner_id" })
  owner?: Employee;

  @Column({ type: "uuid", nullable: true })
  preSalesPersonId?: string;

  @ManyToOne(() => Employee, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "pre_sales_person_id" })
  preSalesPerson?: Employee;

  @Column({ type: "uuid", nullable: true })
  pmoId?: string;

  @ManyToOne(() => Employee, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "pmo_id" })
  pmo?: Employee;

  // Required -- every deal always belongs to a Main Stage, whether or not
  // that Main Stage has any Sub Stages configured. No onDelete action, same
  // "must reassign before delete" reasoning as ownerId below: deleting a
  // Main Stage that still has deals sitting directly in it (no Sub Stage)
  // must be blocked, not silently null this out.
  @Column({ type: "uuid" })
  mainStageId!: string;

  @ManyToOne(() => MainStage)
  @JoinColumn({ name: "main_stage_id" })
  mainStage?: MainStage;

  // Optional -- a deal can sit directly "in" mainStageId above with no Sub
  // Stage breakdown. Set only once the deal is actually placed into a real
  // SubStage. No onDelete action when set — deleting a SubStage that deals
  // currently sit in must still be blocked, same reasoning as owner.
  @Column({ type: "uuid", nullable: true })
  currentStageId?: string;

  @ManyToOne(() => SubStage, { nullable: true })
  @JoinColumn({ name: "current_stage_id" })
  currentStage?: SubStage;

  @Column({ type: "enum", enum: DealStatus, default: DealStatus.Open })
  status!: DealStatus;

  @Column({ type: "uuid", nullable: true })
  departmentId?: string;

  @ManyToOne(() => Department, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "department_id" })
  department?: Department;

  // Deal Information tab
  @Column({ nullable: true })
  dealCountry?: string;

  @Column({ type: "text", nullable: true })
  customerPainPoint?: string;

  // Delivery tab
  @Column({ nullable: true })
  product?: string;

  @Column({ nullable: true })
  services?: string;

  // Costing tab -- estimatedValue below doubles as "Project Value without
  // Tax"; Total Cost/Profit/Markup/Margin are deliberately never stored,
  // only ever derived from these three at read time (frontend already does
  // this via computeCosting()), so they can never drift out of sync with
  // the numbers that produced them.
  @Column({ type: "numeric", precision: 14, scale: 2, nullable: true })
  estimatedValue?: number;

  @Column({ type: "numeric", precision: 14, scale: 2, nullable: true })
  internalCosts?: number;

  @Column({ type: "numeric", precision: 14, scale: 2, nullable: true })
  externalCosts?: number;

  @Column({ type: "date", nullable: true })
  expectedCloseDate?: string;

  // Competition tab -- a list of free-text blurbs with no need to
  // query/filter on individually, per the frontend's own design (see
  // AddDealDialog.tsx), so a single jsonb column rather than a table.
  @Column({ type: "jsonb", nullable: true })
  competitors?: CompetitorEntry[];

  // Tender tab in the Add/Edit Deal dialog only shows when this is true.
  // The richer tender-specific fields (reference number, issuing body,
  // submission deadline, etc.) will live on their own DealTenderDetails
  // record once the field list for that tab is finalized — this flag is
  // deliberately standalone rather than derived from that relation existing,
  // since nothing writes to deal_tender_details yet.
  @Column({ default: false })
  isTender!: boolean;
}
