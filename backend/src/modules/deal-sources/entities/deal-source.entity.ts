import { Column, Entity } from "typeorm";
import { AuditedTenantEntity } from "../../../core/tenant";

@Entity("deal_sources")
export class DealSource extends AuditedTenantEntity {
  @Column()
  name!: string;

  @Column({ nullable: true })
  category?: string;

  @Column({ default: true })
  isActive!: boolean;
}
