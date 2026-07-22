import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { AuditedEntity } from "../../../core/audited.entity";
import { User } from "../../users/entities/user.entity";
import { Deal } from "./deal.entity";

@Entity("deal_notes")
export class DealNote extends AuditedEntity {
  @Column({ type: "uuid" })
  dealId!: string;

  @ManyToOne(() => Deal, { onDelete: "CASCADE" })
  @JoinColumn({ name: "deal_id" })
  deal?: Deal;

  @Column({ type: "text" })
  text!: string;

  // Resolves the inherited createdBy column to a displayable name -- same
  // "extra relation on the base class's plain column" pattern as
  // SubStageHistory's movedByUser, since AuditedEntity's own createdBy is a
  // bare uuid column (no relation, to avoid User's circular-import issue).
  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by" })
  authorUser?: User;
}
