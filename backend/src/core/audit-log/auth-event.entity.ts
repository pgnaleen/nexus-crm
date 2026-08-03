import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { AuthEventReason, AuthEventType } from "@orelia/common";

/**
 * Login activity -- deliberately a separate table from audit_logs, not
 * folded in. See spec-activity-log.md's design section A: audit_logs.action
 * is a 3-value enum with a NOT NULL entity_id (a failed login for an unknown
 * username has no user id to put there), and login() runs before any tenant
 * context exists, so every row through AuditLogService.record() would land
 * with tenant_id NULL -- invisible under own-tenant scoping. AuthEventService
 * takes tenantId as an explicit parameter instead; that's the one thing about
 * this entity most likely to be assumed away, hence this comment.
 *
 * No foreign keys, mirroring audit_logs' own stance -- a row must survive
 * deletion of the user or tenant it references. Never edited or removed once
 * written.
 */
@Entity("auth_events")
export class AuthEvent {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  // NOT NULL, unlike AuditLog.tenantId -- always resolved from the login
  // request's own tenantSlug before this is ever written. See Edge Case 19 /
  // Other Case 4: a slug matching no tenant is simply never recorded, since
  // there is no tenant to attribute it to.
  @Column({ type: "uuid" })
  tenantId!: string;

  // Null when the username didn't resolve to a real user (unknown_user).
  @Column({ type: "uuid", nullable: true })
  userId?: string;

  // As typed at the login form -- the only trace when userId is null.
  // Never the password, hashed or otherwise -- see MailService/UsersService's
  // existing password-redaction precedent, extended here.
  @Column({ type: "varchar", length: 255 })
  usernameAttempted!: string;

  @Column({ type: "enum", enum: AuthEventType })
  eventType!: AuthEventType;

  // Only meaningful on login_failed rows.
  @Column({ type: "varchar", length: 32, nullable: true })
  reason?: AuthEventReason;

  // Text, not inet -- v4 or v6, and simplest to keep symmetric with how it's
  // read back out. Only trustworthy once main.ts sets `trust proxy`
  // correctly -- see AuthService's capture points.
  @Column({ type: "varchar", length: 45, nullable: true })
  ipAddress?: string;

  @Column({ type: "varchar", length: 512, nullable: true })
  userAgent?: string;

  // Plain @Column, not @CreateDateColumn -- this is set explicitly by
  // AuthEventService.record() at the moment of the event, not "whenever the
  // row happens to be inserted" (the two are almost always the same instant,
  // but the explicit column keeps the entity's intent clear).
  @Column({ type: "timestamptz", default: () => "now()" })
  occurredAt!: Date;
}
