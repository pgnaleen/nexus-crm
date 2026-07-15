import { ReviewVote } from "@orelia/common";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Employee } from "../../employees/entities/employee.entity";
import { DealReview } from "./deal-review.entity";

@Entity("deal_review_votes")
export class DealReviewVote {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  reviewId!: string;

  @ManyToOne(() => DealReview, { onDelete: "CASCADE" })
  @JoinColumn({ name: "review_id" })
  review?: DealReview;

  @Column({ type: "uuid" })
  reviewerId!: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: "reviewer_id" })
  reviewer?: Employee;

  @Column({ type: "enum", enum: ReviewVote })
  vote!: ReviewVote;

  @Column({ type: "text", nullable: true })
  comment?: string;

  @Column({ type: "timestamptz", default: () => "now()" })
  votedAt!: Date;
}
