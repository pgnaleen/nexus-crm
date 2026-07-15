import { ReviewDecision, ReviewType } from "@orelia/common";
import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { AuditedEntity } from "../../../core/audited.entity";
import { Deal } from "./deal.entity";

@Entity("deal_reviews")
export class DealReview extends AuditedEntity {
  @Column({ type: "uuid" })
  dealId!: string;

  @ManyToOne(() => Deal, { onDelete: "CASCADE" })
  @JoinColumn({ name: "deal_id" })
  deal?: Deal;

  @Column({ type: "enum", enum: ReviewType })
  reviewType!: ReviewType;

  @Column({ type: "enum", enum: ReviewDecision, default: ReviewDecision.Pending })
  decision!: ReviewDecision;

  @Column({ type: "text", nullable: true })
  overallComment?: string;

  @Column({ type: "timestamptz", nullable: true })
  decidedAt?: Date;
}
