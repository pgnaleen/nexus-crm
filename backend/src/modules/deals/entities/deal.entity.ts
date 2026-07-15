import { DealPriority, DealStatus, DealType } from "@orelia/common";
import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { AuditedTenantEntity } from "../../../core/tenant";
import { Company } from "../../companies/entities/company.entity";
import { Contact } from "../../contacts/entities/contact.entity";
import { DealSource } from "../../deal-sources/entities/deal-source.entity";
import { MainStage } from "../../deal-stages/entities/main-stage.entity";
import { SubStage } from "../../deal-stages/entities/sub-stage.entity";
import { Department } from "../../departments/entities/department.entity";
import { Employee } from "../../employees/entities/employee.entity";

@Entity("deals")
export class Deal extends AuditedTenantEntity {
  @Column()
  dealCode!: string;

  @Column()
  name!: string;

  @Column({ type: "enum", enum: DealType })
  dealType!: DealType;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "uuid" })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: "CASCADE" })
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

  @Column({ type: "uuid", nullable: true })
  referredByCompanyId?: string;

  @ManyToOne(() => Company, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "referred_by_company_id" })
  referredByCompany?: Company;

  @Column({ type: "uuid", nullable: true })
  referredByEmployeeId?: string;

  @ManyToOne(() => Employee, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "referred_by_employee_id" })
  referredByEmployee?: Employee;

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
  mainStageId?: string;

  @ManyToOne(() => MainStage, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "main_stage_id" })
  mainStage?: MainStage;

  @Column({ type: "uuid" })
  currentStageId!: string;

  // No onDelete action — currentStageId is required, so deleting a SubStage
  // that deals currently sit in must be blocked, same reasoning as owner.
  @ManyToOne(() => SubStage)
  @JoinColumn({ name: "current_stage_id" })
  currentStage?: SubStage;

  @Column({ type: "enum", enum: DealStatus, default: DealStatus.Open })
  status!: DealStatus;

  @Column({ type: "numeric", precision: 14, scale: 2, nullable: true })
  estimatedValue?: number;

  @Column({ nullable: true })
  currency?: string;

  @Column({ type: "date", nullable: true })
  expectedCloseDate?: string;

  @Column({ type: "int", nullable: true })
  probability?: number;

  @Column({ type: "enum", enum: DealPriority, nullable: true })
  priority?: DealPriority;

  @Column({ type: "uuid", nullable: true })
  departmentId?: string;

  @ManyToOne(() => Department, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "department_id" })
  department?: Department;

  // tenderDetailsId deferred until deal_tender_details exists (Tender
  // management) — same dependency pattern as Teams_Employee_Map.
}
