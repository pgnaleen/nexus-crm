import { Column, Entity } from "typeorm";
import { AuditedEntity } from "../../../core/audited.entity";

@Entity("plans")
export class Plan extends AuditedEntity {
  @Column()
  name!: string;

  @Column("numeric", { precision: 12, scale: 2 })
  amount!: number;
}
