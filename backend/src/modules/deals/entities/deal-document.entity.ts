import { DocumentType } from "@orelia/common";
import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { AuditedEntity } from "../../../core/audited.entity";
import { Deal } from "./deal.entity";

@Entity("deal_documents")
export class DealDocument extends AuditedEntity {
  @Column({ type: "uuid" })
  dealId!: string;

  @ManyToOne(() => Deal, { onDelete: "CASCADE" })
  @JoinColumn({ name: "deal_id" })
  deal?: Deal;

  @Column({ type: "enum", enum: DocumentType })
  docType!: DocumentType;

  @Column()
  title!: string;

  @Column()
  s3Key!: string;
}
