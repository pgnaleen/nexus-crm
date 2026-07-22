import { Column, DeleteDateColumn } from "typeorm";
import { TenantOwnedEntity } from "./tenant-owned.entity";

/**
 * createdBy/updatedBy/deletedBy are plain uuid columns, not relations to
 * User — see the comment on AuditedEntity for why (avoids a runtime
 * circular-import crash through User's own tenant-owned chain). FK to
 * users(id) ON DELETE SET NULL is still added by hand in each migration.
 */
export abstract class AuditedTenantEntity extends TenantOwnedEntity {
  @Column({ type: "uuid", nullable: true })
  createdBy?: string;

  @Column({ type: "uuid", nullable: true })
  updatedBy?: string;

  @DeleteDateColumn()
  deletedAt?: Date;

  @Column({ type: "uuid", nullable: true })
  deletedBy?: string;
}
