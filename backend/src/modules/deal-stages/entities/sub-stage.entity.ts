import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { AuditedTenantEntity } from "../../../core/tenant";
import { MainStage } from "./main-stage.entity";

@Entity("sub_stages")
export class SubStage extends AuditedTenantEntity {
  @Column()
  name!: string;

  @Column({ type: "int", default: 0 })
  sortOrder!: number;

  @Column({ default: false })
  isWon!: boolean;

  @Column({ default: false })
  isLost!: boolean;

  @Column({ type: "uuid" })
  mainStageId!: string;

  @ManyToOne(() => MainStage, { onDelete: "CASCADE" })
  @JoinColumn({ name: "main_stage_id" })
  mainStage?: MainStage;
}
