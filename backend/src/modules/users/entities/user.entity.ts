import { UserStatus } from "@orelia/common";
import { Column, DeleteDateColumn, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { TenantOwnedEntity } from "../../../core/tenant";

@Entity("users")
@Index(["tenantId", "username"], { unique: true })
export class User extends TenantOwnedEntity {
  // Self-referential audit columns declared here (not via the shared
  // AuditedTenantEntity base) because that base imports User for its own
  // createdBy/updatedBy relations — User extending it would be a circular
  // "class extends" that crashes at runtime (tsc doesn't catch this).
  @Column({ type: "uuid", nullable: true })
  createdBy?: string;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by" })
  createdByUser?: User;

  @Column({ type: "uuid", nullable: true })
  updatedBy?: string;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "updated_by" })
  updatedByUser?: User;

  @DeleteDateColumn()
  deletedAt?: Date;

  @Column()
  username!: string;

  @Column()
  passwordHash!: string;

  @Column()
  displayName!: string;

  @Column({ type: "enum", enum: UserStatus, default: UserStatus.Active })
  status!: UserStatus;

  @Column()
  loggingEmail!: string;

  @Column({ type: "timestamptz", nullable: true })
  lastLoggingAt?: Date;

  @Column({ type: "int", default: 0 })
  loggingAttempts!: number;

  @Column({ default: false })
  mustChangePassword!: boolean;

  @Column({ type: "text", nullable: true })
  extras?: string;
}
