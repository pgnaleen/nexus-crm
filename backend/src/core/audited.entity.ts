import { Column, CreateDateColumn, DeleteDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

/**
 * Base for platform-level tables (no tenant_id — shared/global, e.g. Tenants
 * itself, Plans, Industries).
 *
 * createdBy/updatedBy/deletedBy are plain uuid columns, not `@ManyToOne` relations to
 * User — a relation here would import User, and User's own module chain
 * (via TenantOwnedEntity) loops back to Tenant, which extends this class.
 * That cycle crashes at runtime ("Class extends value undefined") even
 * though tsc reports no errors, since it's a module-load-order issue, not a
 * type error. The FK to users(id) ON DELETE SET NULL is still enforced at
 * the DB level — just added by hand in each migration instead of generated
 * from relation metadata.
 */
export abstract class AuditedEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @Column({ type: "uuid", nullable: true })
  createdBy?: string;

  @Column({ type: "uuid", nullable: true })
  updatedBy?: string;

  @DeleteDateColumn({ type: "timestamptz" })
  deletedAt?: Date;

  @Column({ type: "uuid", nullable: true })
  deletedBy?: string;
}
