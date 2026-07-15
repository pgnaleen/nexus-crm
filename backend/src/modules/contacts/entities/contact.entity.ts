import { RoleBuying } from "@orelia/common";
import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { AuditedTenantEntity } from "../../../core/tenant";
import { Company } from "../../companies/entities/company.entity";
import { User } from "../../users/entities/user.entity";

@Entity("contacts")
export class Contact extends AuditedTenantEntity {
  @Column()
  fullName!: string;

  @Column({ nullable: true })
  title?: string;

  @Column({ nullable: true })
  department?: string;

  @Column({ type: "enum", enum: RoleBuying, nullable: true })
  roleBuying?: RoleBuying;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  mobileNo?: string;

  @Column({ nullable: true })
  directPhoneNo?: string;

  @Column({ nullable: true })
  linkedIn?: string;

  @Column({ type: "jsonb", nullable: true })
  preferredChannels?: string[];

  @Column({ type: "jsonb", nullable: true })
  languages?: string[];

  @Column({ nullable: true })
  country?: string;

  @Column({ nullable: true })
  timezone?: string;

  @Column({ nullable: true })
  relationshipOwner?: string;

  @Column({ nullable: true })
  photoUrl?: string;

  @Column({ type: "date", nullable: true })
  dob?: string;

  @Column({ type: "uuid", nullable: true })
  userId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "user_id" })
  user?: User;

  @Column({ type: "uuid", nullable: true })
  companyId?: string;

  @ManyToOne(() => Company, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "company_id" })
  company?: Company;
}
