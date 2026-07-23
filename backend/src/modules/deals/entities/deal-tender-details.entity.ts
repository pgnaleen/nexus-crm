import { EvaluationType, SubmissionMode } from "@orelia/common";
import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { AuditedTenantEntity } from "../../../core/tenant";
import { Deal } from "./deal.entity";

@Entity("deal_tender_details")
export class DealTenderDetails extends AuditedTenantEntity {
  @Column({ type: "uuid" })
  dealId!: string;

  @ManyToOne(() => Deal, { onDelete: "CASCADE" })
  @JoinColumn({ name: "deal_id" })
  deal?: Deal;

  @Column()
  tenderReference!: string;

  @Column()
  issuingBody!: string;

  // Deliberately no submission deadline column here -- Deal.expectedCloseDate
  // already covers it, and duplicating it here would just be a second date
  // that can drift out of sync.
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
