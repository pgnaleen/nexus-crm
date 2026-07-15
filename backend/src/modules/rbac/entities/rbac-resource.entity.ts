import { RbacRiskLevel } from "@orelia/common";
import { Column, Entity } from "typeorm";
import { AuditedEntity } from "../../../core/audited.entity";

@Entity("rbac_resources")
export class RbacResource extends AuditedEntity {
  @Column({ unique: true })
  name!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "enum", enum: RbacRiskLevel, default: RbacRiskLevel.Low })
  riskLevel!: RbacRiskLevel;

  @Column({ default: false })
  isPlatformOnly!: boolean;
}
