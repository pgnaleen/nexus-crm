import { Check, Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { AuditedTenantEntity } from "../../../core/tenant";
import { Company } from "../../companies/entities/company.entity";
import { Contact } from "../../contacts/entities/contact.entity";
import { RelationshipType } from "./relationship-type.entity";

@Entity("relationship_company_contact_map")
@Check(
  `("company_id" IS NOT NULL AND "contact_id" IS NULL) OR ("company_id" IS NULL AND "contact_id" IS NOT NULL)`,
)
export class RelationshipCompanyContactMap extends AuditedTenantEntity {
  @Column({ type: "uuid" })
  relationshipTypeId!: string;

  @ManyToOne(() => RelationshipType, { onDelete: "CASCADE" })
  @JoinColumn({ name: "relationship_type_id" })
  relationshipType?: RelationshipType;

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

  @Column({ default: true })
  isActive!: boolean;
}
