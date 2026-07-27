import { ClearanceLevel, EmployeeTitle, EmploymentStatus, EmploymentType, Gender } from "@orelia/common";
import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { AuditedTenantEntity } from "../../../core/tenant";
import { Department } from "../../departments/entities/department.entity";
import { User } from "../../users/entities/user.entity";

@Entity("employees")
export class Employee extends AuditedTenantEntity {
  @Column({ nullable: true })
  employeeCode?: string;

  // Salutation (Mr/Mrs/Ms/Miss/Dr) -- job title lives on currentDesignation,
  // not here.
  @Column({ type: "enum", enum: EmployeeTitle, nullable: true })
  title?: EmployeeTitle;

  @Column()
  fullName!: string;

  @Column({ type: "date", nullable: true })
  dateOfBirth?: string;

  @Column({ type: "enum", enum: Gender, nullable: true })
  gender?: Gender;

  @Column({ nullable: true })
  nationality?: string;

  @Column({ nullable: true })
  currentDesignation?: string;

  @Column({ type: "uuid", nullable: true })
  departmentId?: string;

  @ManyToOne(() => Department, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "department_id" })
  department?: Department;

  @Column({ type: "uuid", nullable: true })
  reportingManagerId?: string;

  @ManyToOne(() => Employee, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "reporting_manager_id" })
  reportingManager?: Employee;

  // Story 1.8 -- placed directly beneath the Company root on the org chart
  // (i.e. top of a reporting line). Distinct from "unplaced": both have
  // reportingManagerId NULL, but unplaced employees sit in the side panel.
  // Only ever written by the org chart editor's batch save.
  @Column({ default: false })
  placedAtRoot!: boolean;

  @Column({ type: "enum", enum: EmploymentType, nullable: true })
  employmentType?: EmploymentType;

  @Column({ type: "enum", enum: EmploymentStatus, nullable: true })
  employmentStatus?: EmploymentStatus;

  @Column({ type: "date", nullable: true })
  dateOfJoined?: string;

  @Column({ type: "date", nullable: true })
  dateOfExit?: string;

  @Column({ nullable: true })
  primaryLocation?: string;

  @Column({ nullable: true })
  baseCountry?: string;

  @Column({ type: "enum", enum: ClearanceLevel, nullable: true })
  clearanceLevel?: ClearanceLevel;

  @Column({ type: "text", nullable: true })
  bio?: string;

  // Profile photo and CV live in the shared `documents` table (ownerType
  // EmployeePhoto/EmployeeCv, ownerId this row's id) -- see documents.module.ts.
  @Column({ type: "timestamptz", nullable: true })
  cvLastUpdated?: Date;

  // Value stored encrypted at rest (encrypt/decrypt handled at the application
  // layer when that feature is built — this column just holds the ciphertext).
  @Column({ type: "text", nullable: true })
  nicPassportNumber?: string;

  @Column({ default: false })
  nicPassportEncrypted!: boolean;

  @Column({ type: "numeric", precision: 12, scale: 2, nullable: true })
  baseSalary?: number;

  @Column({ type: "uuid", nullable: true })
  userId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "user_id" })
  user?: User;

  @Column({ nullable: true })
  employeeEmail?: string;

  @Column({ nullable: true })
  mobileNo?: string;

  @Column({ nullable: true })
  officeNo?: string;
}
