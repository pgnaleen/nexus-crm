import { Column, Entity } from "typeorm";
import { AuditedTenantEntity } from "../../../core/tenant";

@Entity("departments")
export class Department extends AuditedTenantEntity {
  @Column()
  name!: string;
}
