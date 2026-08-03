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

  // Story 1.9 -- read the recorded trail for one entity, oldest-first, for a
  // detail view's lifecycle history. Tenant-scoped: never returns another
  // tenant's rows even if a caller somehow passes a foreign entityId.
  async findForEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    let tenantId: string | undefined;
    try {
      tenantId = this.tenantContext.getTenantId();
    } catch {
      tenantId = undefined;
    }
    return this.repo.find({
      where: { entityType, entityId, ...(tenantId ? { tenantId } : {}) },
      order: { occurredAt: "ASC" },
    });
  }

  // Deal Activity Log (Task 8, plan-funnel-deal-management.md) -- same trail as
  // findForEntity above, but newest-first and with the actor's display name
  // resolved via a single LEFT JOIN, mirroring activity-log.service.ts's
  // findAuditLog. Kept as its own method rather than changing findForEntity,
  // since PriorityTasksService.getHistory() depends on that one's oldest-first
  // ordering and bare-entity shape.
  async findForEntityWithActors(
    entityType: string,
    entityId: string,
  ): Promise<Array<{ id: string; action: AuditAction; actorId?: string; actorName: string | null; occurredAt: Date; changes?: Record<string, unknown> }>> {
    this.logger.debug(`findForEntityWithActors called: ${entityType}:${entityId}`);
    try {
      let tenantId: string | undefined;
      try {
        tenantId = this.tenantContext.getTenantId();
      } catch {
        this.logger.debug("No tenant context available -- querying without a tenant filter");
      }

      const qb = this.repo
        .createQueryBuilder("al")
        .leftJoin("users", "actor", "actor.id = al.actor_id")
        .select([
          "al.id AS id",
          "al.action AS action",
          "al.actor_id AS actor_id",
          "actor.display_name AS actor_name",
          "al.occurred_at AS occurred_at",
          "al.changes AS changes",
        ])
        .where("al.entity_type = :entityType", { entityType })
        .andWhere("al.entity_id = :entityId", { entityId })
        .orderBy("al.occurred_at", "DESC");

      if (tenantId) {
        qb.andWhere("al.tenant_id = :tenantId", { tenantId });
      }

      const rows = await qb.getRawMany<{
        id: string;
        action: AuditAction;
        actor_id: string | null;
        actor_name: string | null;
        occurred_at: Date;
        changes: Record<string, unknown> | null;
      }>();

      this.logger.debug(`findForEntityWithActors returning ${rows.length} row(s) for ${entityType}:${entityId}`);
      return rows.map((row) => ({
        id: row.id,
        action: row.action,
        actorId: row.actor_id ?? undefined,
        actorName: row.actor_name ?? null,
        occurredAt: row.occurred_at,
        changes: row.changes ?? undefined,
      }));
    } catch (err) {
      this.logger.error(
        `findForEntityWithActors failed for ${entityType}:${entityId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    }
  }

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
