import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Company } from "../../companies/entities/company.entity";
import { Contact } from "../../contacts/entities/contact.entity";
import { User } from "../../users/entities/user.entity";
import { RelationshipType } from "./relationship-type.entity";

@Entity("relationship_company_contact_map")
export class RelationshipCompanyContactMap {
  @PrimaryColumn({ type: "uuid" })
  relationshipTypeId!: string;

  @ManyToOne(() => RelationshipType, { onDelete: "CASCADE" })
  @JoinColumn({ name: "relationship_type_id" })
  relationshipType?: RelationshipType;

  @PrimaryColumn({ type: "uuid" })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: "CASCADE" })
  @JoinColumn({ name: "company_id" })
  company?: Company;

  @PrimaryColumn({ type: "uuid" })
  contactId!: string;

  @ManyToOne(() => Contact, { onDelete: "CASCADE" })
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
