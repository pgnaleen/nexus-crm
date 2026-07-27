import { Column, Entity } from "typeorm";
import { AuditedTenantEntity } from "../../../core/tenant";

@Entity("main_stages")
export class MainStage extends AuditedTenantEntity {
  @Column()
  name!: string;

  @Column({ type: "int", default: 0 })
  position!: number;

  // A deal can sit directly in a Main Stage with no Sub Stage breakdown --
  // these mirror SubStage.isWon/isLost so that path still has somewhere to
  // derive Won/Lost status from.
  @Column({ default: false })
  isWon!: boolean;

  @Column({ default: false })
  isLost!: boolean;
}
