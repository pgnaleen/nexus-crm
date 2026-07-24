import { EmployeeCertificationStatus } from "@orelia/common";
import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { AuditedTenantEntity } from "../../../core/tenant";
import { Employee } from "../../employees/entities/employee.entity";

// Story 1.12 -- one row per certification an employee claims. Many per
// employee (a separate table, not columns on Employee). Verified/Rejected
// bookkeeping (verifiedById/verifiedAt/rejectionReason) is written by HR in
// Story 1.13; it lives on the row from creation but stays null until reviewed.
@Entity("employee_certifications")
export class EmployeeCertification extends AuditedTenantEntity {
  @Column({ type: "uuid" })
  employeeId!: string;

  @ManyToOne(() => Employee, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "employee_id" })
  employee?: Employee;

  @Column()
  name!: string;

  @Column()
  issuingOrganization!: string;

  @Column({ nullable: true })
  credentialId?: string;

  @Column({ type: "date" })
  issueDate!: string;

  @Column({ type: "date", nullable: true })
  expiryDate?: string;

  @Column({ nullable: true })
  evidenceFileUrl?: string;

  @Column({ nullable: true })
  evidenceLink?: string;

  @Column({ type: "enum", enum: EmployeeCertificationStatus, default: EmployeeCertificationStatus.Pending })
  status!: EmployeeCertificationStatus;

  // Story 1.13 -- set when HR verifies. userId, not employeeId (the actor is
  // a login account). Plain uuid + hand-added FK, same reasoning as the
  // audit columns on AuditedTenantEntity.
  @Column({ type: "uuid", nullable: true })
  verifiedById?: string;

  @Column({ type: "timestamptz", nullable: true })
  verifiedAt?: Date;

  @Column({ type: "text", nullable: true })
  rejectionReason?: string;
}
