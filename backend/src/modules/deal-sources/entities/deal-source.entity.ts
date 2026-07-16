import { DealSourceCategory } from "@orelia/common";
import { Column, Entity } from "typeorm";
import { AuditedTenantEntity } from "../../../core/tenant";

@Entity("deal_sources")
export class DealSource extends AuditedTenantEntity {
  @Column()
  name!: string;

  @Column({ type: "enum", enum: DealSourceCategory, nullable: true })
  category?: DealSourceCategory | null;

  @Column({ default: true })
  isActive!: boolean;
}
