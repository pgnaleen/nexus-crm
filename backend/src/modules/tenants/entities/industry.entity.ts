import { Column, Entity } from "typeorm";
import { AuditedEntity } from "../../../core/audited.entity";

@Entity("industries")
export class Industry extends AuditedEntity {
  @Column()
  name!: string;
}
