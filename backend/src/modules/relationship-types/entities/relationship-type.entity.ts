import { SystemRole } from "@orelia/common";
import { Column, Entity } from "typeorm";
import { AuditedTenantEntity } from "../../../core/tenant";

@Entity("relationship_types")
export class RelationshipType extends AuditedTenantEntity {
  @Column()
  name!: string;

  @Column({ type: "enum", enum: SystemRole, name: "system_role", nullable: true })
  systemRole?: SystemRole | null;
}
