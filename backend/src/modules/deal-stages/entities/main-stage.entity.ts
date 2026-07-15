import { Column, Entity } from "typeorm";
import { AuditedTenantEntity } from "../../../core/tenant";

@Entity("main_stages")
export class MainStage extends AuditedTenantEntity {
  @Column()
  name!: string;

  @Column({ type: "int", default: 0 })
  position!: number;
}
