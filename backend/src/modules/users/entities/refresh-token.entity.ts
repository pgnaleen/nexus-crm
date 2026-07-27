import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Tenant } from "../../tenants/entities/tenant.entity";
import { User } from "./user.entity";

@Entity("refresh_tokens")
export class RefreshToken {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user?: User;

  @Column({ type: "uuid" })
  tenantId!: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: "tenant_id" })
  tenant?: Tenant;

  @Column({ unique: true })
  tokenHash!: string;

  @Column({ type: "timestamptz" })
  expiresAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  revokedAt?: Date;

  // Grace-window reuse (see plan-auth-cross-tab-session-sync.md, Fix A):
  // graceToken caches the *new* raw refresh token on this row at the moment
  // it's rotated out, so a second caller presenting this same old token
  // within graceExpiresAt gets the identical new pair instead of a 401.
  // Deliberately plaintext (every other token here is stored hashed) --
  // bounded to a ~10s window, explicitly signed off in the plan doc.
  @Column({ nullable: true })
  graceToken?: string;

  @Column({ type: "timestamptz", nullable: true })
  graceExpiresAt?: Date;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
