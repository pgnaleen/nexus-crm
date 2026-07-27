import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { SubStage } from "../../deal-stages/entities/sub-stage.entity";
import { User } from "../../users/entities/user.entity";
import { Deal } from "./deal.entity";

@Entity("sub_stage_history")
export class SubStageHistory {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  dealId!: string;

  @ManyToOne(() => Deal, { onDelete: "CASCADE" })
  @JoinColumn({ name: "deal_id" })
  deal?: Deal;

  @Column({ type: "uuid", nullable: true })
  fromStageId?: string;

  @ManyToOne(() => SubStage, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "from_stage_id" })
  fromStage?: SubStage;

  // Nullable -- a move that leaves the deal with no Sub Stage (dropped to a
  // Main-Stage-only position) still deserves a history row, just with no
  // "to" Sub Stage to point at.
  @Column({ type: "uuid", nullable: true })
  toStageId?: string;

  @ManyToOne(() => SubStage, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "to_stage_id" })
  toStage?: SubStage;

  @Column({ name: "moved_by", type: "uuid", nullable: true })
  movedById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "moved_by" })
  movedByUser?: User;

  @Column({ type: "timestamptz", default: () => "now()" })
  movedAt!: Date;

  @Column({ type: "text", nullable: true })
  note?: string;
}
