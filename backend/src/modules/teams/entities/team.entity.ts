import { Column, Entity } from "typeorm";
import { AuditedTenantEntity } from "../../../core/tenant";

@Entity("teams")
export class Team extends AuditedTenantEntity {
  @Column()
  name!: string;
}
