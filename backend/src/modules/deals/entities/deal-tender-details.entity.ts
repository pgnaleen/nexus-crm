import { EvaluationType, SubmissionMode } from "@orelia/common";
import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { AuditedEntity } from "../../../core/audited.entity";
import { Deal } from "./deal.entity";

@Entity("deal_tender_details")
export class DealTenderDetails extends AuditedEntity {
  @Column({ type: "uuid" })
  dealId!: string;

  @ManyToOne(() => Deal, { onDelete: "CASCADE" })
  @JoinColumn({ name: "deal_id" })
  deal?: Deal;

  @Column()
  tenderReference!: string;

  @Column()
  issuingBody!: string;

  @Column({ type: "timestamptz", nullable: true })
  submissionDeadline?: Date;

  @Column({ default: false })
  bidBondRequired!: boolean;

  @Column({ type: "numeric", precision: 14, scale: 2, nullable: true })
  bidBondAmount?: number;

  @Column({ type: "numeric", precision: 14, scale: 2, nullable: true })
  emdAmount?: number;

  @Column({ type: "enum", enum: SubmissionMode, nullable: true })
  submissionMode?: SubmissionMode;

  @Column({ type: "enum", enum: EvaluationType, nullable: true })
  evaluationType?: EvaluationType;
}
