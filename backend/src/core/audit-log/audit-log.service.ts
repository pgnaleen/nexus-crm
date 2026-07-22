import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TenantContextService } from "../tenant";
import { AuditAction, AuditLog } from "./audit-log.entity";

export interface RecordAuditLogInput {
  entityType: string;
  entityId: string;
  action: AuditAction;
  actorId?: string;
  changes?: Record<string, unknown>;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async record(input: RecordAuditLogInput): Promise<void> {
    this.logger.debug(
      `record called: ${input.action} ${input.entityType}:${input.entityId} by ${input.actorId ?? "unknown"}`,
    );
    try {
      let tenantId: string | undefined;
      try {
        tenantId = this.tenantContext.getTenantId();
      } catch {
        this.logger.debug("No tenant context available -- recording as a platform-level entry");
      }

      const log = this.repo.create({
        tenantId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        actorId: input.actorId,
        changes: input.changes,
      });
      await this.repo.save(log);
      this.logger.debug(`record succeeded for ${input.entityType}:${input.entityId}`);
    } catch (err) {
      // Deliberately swallowed, not rethrown -- unlike every other service in
      // this codebase. Audit logging is best-effort observability sitting
      // alongside the real operation, not a data-integrity requirement of it;
      // a transient failure writing an audit_logs row must never fail the
      // caller's actual create/update/delete.
      this.logger.error(
        `record failed for ${input.entityType}:${input.entityId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }
}
