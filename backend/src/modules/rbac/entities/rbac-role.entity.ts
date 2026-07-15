import { Column, Entity, Index } from "typeorm";
import { AuditedTenantEntity } from "../../../core/tenant";

@Entity("rbac_roles")
@Index(["tenantId", "name"], { unique: true })
export class RbacRole extends AuditedTenantEntity {
  @Column()
  name!: string;

  @Column({ type: "text", nullable: true })
  description?: string;
}