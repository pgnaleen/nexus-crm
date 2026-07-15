import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Contact } from "../../contacts/entities/contact.entity";
import { User } from "../../users/entities/user.entity";
import { Deal } from "./deal.entity";

@Entity("deal_contacts_map")
export class DealContactsMap {
  @PrimaryColumn({ type: "uuid" })
  dealId!: string;

  @ManyToOne(() => Deal, { onDelete: "CASCADE" })
  @JoinColumn({ name: "deal_id" })
  deal?: Deal;

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
