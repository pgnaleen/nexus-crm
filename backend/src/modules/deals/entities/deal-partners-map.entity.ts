import { Check, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Company } from "../../companies/entities/company.entity";
import { Contact } from "../../contacts/entities/contact.entity";
import { User } from "../../users/entities/user.entity";
import { Deal } from "./deal.entity";

@Entity("deal_partners_map")
@Check(`("company_id" IS NOT NULL AND "contact_id" IS NULL) OR ("company_id" IS NULL AND "contact_id" IS NOT NULL)`)
export class DealPartnersMap {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  dealId!: string;

  @ManyToOne(() => Deal, { onDelete: "CASCADE" })
  @JoinColumn({ name: "deal_id" })
  deal?: Deal;

  @Column({ type: "uuid", nullable: true })
  companyId?: string;

  @ManyToOne(() => Company, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "company_id" })
  company?: Company;

  @Column({ type: "uuid", nullable: true })
  contactId?: string;

  @ManyToOne(() => Contact, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "contact_id" })
  contact?: Contact;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ name: "created_by", type: "uuid", nullable: true })
  createdById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by" })
  createdByUser?: User;
}
