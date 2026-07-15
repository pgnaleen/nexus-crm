import { Column, Entity } from "typeorm";
import { AuditedTenantEntity } from "../../../core/tenant";

@Entity("relationship_types")
export class RelationshipType extends AuditedTenantEntity {
  @Column()
  name!: string;
}
