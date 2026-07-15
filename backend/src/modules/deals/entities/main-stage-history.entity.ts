import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { MainStage } from "../../deal-stages/entities/main-stage.entity";
import { User } from "../../users/entities/user.entity";
import { Deal } from "./deal.entity";

@Entity("main_stage_history")
export class MainStageHistory {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  dealId!: string;

  @ManyToOne(() => Deal, { onDelete: "CASCADE" })
  @JoinColumn({ name: "deal_id" })
  deal?: Deal;

  @Column({ type: "uuid", nullable: true })
  fromStageId?: string;

  @ManyToOne(() => MainStage, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "from_stage_id" })
  fromStage?: MainStage;

  @Column({ type: "uuid" })
  toStageId!: string;

  @ManyToOne(() => MainStage)
  @JoinColumn({ name: "to_stage_id" })
  toStage?: MainStage;

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
