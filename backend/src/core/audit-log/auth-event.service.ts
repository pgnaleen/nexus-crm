import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuthEventReason, AuthEventType } from "@orelia/common";
import { AuthEvent } from "./auth-event.entity";

export interface RecordAuthEventInput {
  // Explicit, not read from TenantContextService -- login() runs on a
  // @Public() route before any tenant context exists (see auth-event.entity.ts's
  // own comment). Every call site resolves this from the login request's own
  // tenantSlug/the already-authenticated user, never from ambient context.
  tenantId: string;
  userId?: string;
  usernameAttempted: string;
  eventType: AuthEventType;
  reason?: AuthEventReason;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Records login activity -- see auth-event.entity.ts for why this is a
 * separate table/service from AuditLogService rather than reusing it.
 * Registered globally via CoreModule, same as AuditLogService.
 */
@Injectable()
export class AuthEventService {
  private readonly logger = new Logger(AuthEventService.name);

  constructor(@InjectRepository(AuthEvent) private readonly repo: Repository<AuthEvent>) {}

  // Best-effort, never throws -- matches AuditLogService.record()'s
  // documented posture exactly: a logging failure must never break login,
  // logout, or account-lock handling. Spec-activity-log.md Edge Case 12.
  async record(input: RecordAuthEventInput): Promise<void> {
    this.logger.debug(
      `record called: ${input.eventType} for "${input.usernameAttempted}" (tenant=${input.tenantId}, reason=${input.reason ?? "none"})`,
    );
    try {
      const event = this.repo.create({
        tenantId: input.tenantId,
        userId: input.userId,
        usernameAttempted: input.usernameAttempted,
        eventType: input.eventType,
        reason: input.reason,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });
      await this.repo.save(event);
      this.logger.debug(`record succeeded: ${input.eventType} for "${input.usernameAttempted}"`);
    } catch (err) {
      // Deliberately swallowed, not rethrown -- same reasoning as
      // AuditLogService.record(): this is best-effort observability, not a
      // data-integrity requirement of the login/logout it rides alongside.
      this.logger.error(
        `record failed for ${input.eventType} ("${input.usernameAttempted}"): ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }
}
