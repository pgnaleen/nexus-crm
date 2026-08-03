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

  @DeleteDateColumn({ type: "timestamptz" })
  deletedAt?: Date;

  @Column({ type: "uuid", nullable: true })
  deletedBy?: string;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "deleted_by" })
  deletedByUser?: User;

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

  // Explicitly `| null` (not just optional/undefined) -- TypeORM's save()
  // skips a column entirely when the property is `undefined`, only a real
  // `null` assignment actually clears it. Both auth.service.ts (successful
  // login) and UsersService.resetPassword (admin unlock) need to genuinely
  // clear this, not just leave it stale in memory for the current request.
  @Column({ type: "timestamptz", nullable: true })
  lockedUntil?: Date | null;

  @Column({ default: false })
  mustChangePassword!: boolean;

  @Column({ type: "text", nullable: true })
  extras?: string;
}
