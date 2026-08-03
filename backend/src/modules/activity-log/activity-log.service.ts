import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, SelectQueryBuilder } from "typeorm";
import {
  ActivityLogFilterOptionsResponse,
  AuditLogEntryResponse,
  AuthEventResponse,
  PaginatedResponse,
  SYSTEM_TENANT_SLUG,
} from "@orelia/common";
import { AuditLog } from "../../core/audit-log/audit-log.entity";
import { AuthEvent } from "../../core/audit-log/auth-event.entity";
import { TenantContextService } from "../../core/tenant";
import { MAX_ACTIVITY_LOG_PAGE_SIZE, QueryActivityLogDto } from "./dto/query-activity-log.dto";

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_LOOKBACK_DAYS = 30;

// Server-side only -- see spec-activity-log.md Other Case 6, the
// highest-severity finding in the whole feature. `changes` for an insert is
// sometimes a full DTO spread (e.g. deals.service.ts's {...dto, dealCode}),
// so an employee insert's audit row holds NIC/passport/salary in plain
// jsonb. Redacting here, before the row ever leaves this service, is the
// only place that actually matters -- a frontend-only mask still ships the
// real value over HTTP.
const ALWAYS_REDACTED = new Set([
  "password",
  "passwordHash",
  "newPassword",
  "token",
  "refreshToken",
  "tokenHash",
  "secret",
  "graceToken",
]);
// Gated on the VIEWER also holding EMPLOYEES_VIEW_SENSITIVE -- AUDIT_LOG_VIEW
// is not an unqualified all-access key, it's intersected with that permission
// for these specific fields. Field names are this codebase's real ones
// (Employee entity), not generic guesses.
const SENSITIVE_HR = new Set(["nicPassportNumber", "baseSalary"]);

interface TenantScopeOptions {
  allTenants?: boolean;
  tenantId?: string;
}

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(
    @InjectRepository(AuditLog) private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(AuthEvent) private readonly authEventRepo: Repository<AuthEvent>,
    private readonly tenantContext: TenantContextService,
  ) {}

  // True only for a genuine System-tenant session -- NOT act-as-tenant.
  // TenantContextInterceptor overwrites tenantId/tenantSlug to the acted-as
  // tenant's values whenever an act-as-tenant cookie is active (see its own
  // source), so this already correctly returns false while a System admin
  // is impersonating tenant X -- no separate "not acting-as" check needed.
  private isPlatformSession(): boolean {
    try {
      return this.tenantContext.getTenantSlug() === SYSTEM_TENANT_SLUG;
    } catch {
      return false;
    }
  }

  // The one method every query in this service must route its tenant
  // predicate through. AuditLog/AuthEvent are bare @Entity classes, not
  // TenantOwnedEntity, so BaseTenantRepository's automatic scoping doesn't
  // apply -- this hand-written equivalent enforces the identical invariant.
  // A non-platform caller's allTenants/tenantId is never honored, regardless
  // of what the (already-validated, but not yet trusted) DTO says.
  private applyTenantScope<T extends AuditLog | AuthEvent>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    options: TenantScopeOptions,
  ): void {
    const platform = this.isPlatformSession();
    if (platform && options.tenantId) {
      qb.andWhere(`${alias}.tenant_id = :scopeTenantId`, { scopeTenantId: options.tenantId });
      return;
    }
    if (platform && options.allTenants) {
      return;
    }
    qb.andWhere(`${alias}.tenant_id = :ownTenantId`, { ownTenantId: this.tenantContext.getTenantId() });
  }

  private redactChanges(
    changes: Record<string, unknown> | null,
    canViewSensitiveHr: boolean,
  ): Record<string, unknown> | null {
    if (!changes) return null;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(changes)) {
      const mustRedact = ALWAYS_REDACTED.has(key) || (SENSITIVE_HR.has(key) && !canViewSensitiveHr);
      if (!mustRedact) {
        result[key] = value;
        continue;
      }
      // Recurse into {old, new} pairs rather than blanking the whole entry,
      // so an update's diff still shows *that* the field changed.
      if (value && typeof value === "object" && !Array.isArray(value) && ("old" in value || "new" in value)) {
        result[key] = { old: "[redacted]", new: "[redacted]" };
      } else {
        result[key] = "[redacted]";
      }
    }
    return result;
  }

  private paginationDefaults(dto: QueryActivityLogDto): { page: number; pageSize: number; offset: number } {
    const pageSize = Math.min(dto.pageSize ?? DEFAULT_PAGE_SIZE, MAX_ACTIVITY_LOG_PAGE_SIZE);
    const page = dto.page ?? 1;
    return { page, pageSize, offset: (page - 1) * pageSize };
  }

  // Defaults to the last 30 days when the caller sends neither bound --
  // both the sane default and the performance guardrail (an unbounded date
  // range is the one filter guaranteed to make every index here useless).
  private applyDateRange(qb: SelectQueryBuilder<AuditLog | AuthEvent>, alias: string, dto: QueryActivityLogDto): void {
    if (dto.from) {
      qb.andWhere(`${alias}.occurred_at >= :from`, { from: dto.from });
    } else if (!dto.to) {
      const cutoff = new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
      qb.andWhere(`${alias}.occurred_at >= :defaultFrom`, { defaultFrom: cutoff.toISOString() });
    }
    if (dto.to) {
      qb.andWhere(`${alias}.occurred_at <= :to`, { to: dto.to });
    }
  }

  async findAuditLog(dto: QueryActivityLogDto, canViewSensitiveHr: boolean): Promise<PaginatedResponse<AuditLogEntryResponse>> {
    this.logger.debug(`findAuditLog called (page=${dto.page ?? 1}, search=${dto.search ?? "none"})`);
    try {
      const { page, pageSize, offset } = this.paginationDefaults(dto);

      const qb = this.auditLogRepo
        .createQueryBuilder("al")
        // Deliberately NOT tenant-scoped and NOT filtered on deleted_at --
        // raw SQL bypasses TypeORM's soft-delete filter, which is exactly
        // what's wanted: an actor may have been deleted since, and the row
        // must still render ("Unknown user"), not disappear. actor.tenant_id
        // is selected too so a cross-tenant actor (a System admin who acted
        // as this tenant) can be detected and never have their real name
        // leaked into this tenant's log -- see the mapper below.
        .leftJoin("users", "actor", "actor.id = al.actor_id")
        .select([
          "al.id AS id",
          "al.occurred_at AS occurred_at",
          "al.action AS action",
          "al.entity_type AS entity_type",
          "al.entity_id AS entity_id",
          "al.tenant_id AS tenant_id",
          "al.actor_id AS actor_id",
          "al.changes AS changes",
          "actor.display_name AS actor_name",
          "actor.tenant_id AS actor_tenant_id",
        ]);

      this.applyTenantScope(qb, "al", dto);
      this.applyDateRange(qb, "al", dto);

      if (dto.actorId) qb.andWhere("al.actor_id = :actorId", { actorId: dto.actorId });
      if (dto.modules && dto.modules.length > 0) qb.andWhere("al.entity_type IN (:...modules)", { modules: dto.modules });
      if (dto.actions && dto.actions.length > 0) qb.andWhere("al.action IN (:...actions)", { actions: dto.actions });
      if (dto.search) {
        // Free-text search covers the actor's own name too (a per-row
        // second lookup couldn't do this) -- plain ILIKE on top of the
        // mandatory date range, not a GIN/trigram index yet. See the
        // migration's own comment on why that's deferred.
        qb.andWhere("(al.changes::text ILIKE :search OR al.entity_type ILIKE :search OR actor.display_name ILIKE :search)", {
          search: `%${dto.search}%`,
        });
      }

      const total = await qb.getCount();
      // ORDER BY occurred_at DESC, id DESC -- the id tiebreaker is mandatory,
      // not cosmetic: without it, two rows sharing a timestamp can swap
      // between page 1 and page 2 and be shown twice or skipped entirely.
      const rows = await qb.orderBy("al.occurred_at", "DESC").addOrderBy("al.id", "DESC").offset(offset).limit(pageSize).getRawMany();

      const items: AuditLogEntryResponse[] = rows.map((row) => {
        const isPlatformActor = !!row.actor_tenant_id && row.actor_tenant_id !== row.tenant_id;
        return {
          id: row.id,
          occurredAt: new Date(row.occurred_at).toISOString(),
          action: row.action,
          entityType: row.entity_type,
          entityId: row.entity_id,
          tenantId: row.tenant_id,
          tenantName: row.tenant_id, // resolved below in bulk
          actorId: row.actor_id,
          actorName: isPlatformActor ? null : (row.actor_name ?? null),
          actorIsPlatform: isPlatformActor,
          changes: this.redactChanges(row.changes, canViewSensitiveHr),
        };
      });

      await this.resolveTenantNames(items);

      this.logger.debug(`findAuditLog returning ${items.length}/${total} row(s)`);
      return { items, total, page, pageSize };
    } catch (err) {
      this.logger.error(`findAuditLog failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async findAuthEvents(dto: QueryActivityLogDto): Promise<PaginatedResponse<AuthEventResponse>> {
    this.logger.debug(`findAuthEvents called (page=${dto.page ?? 1}, search=${dto.search ?? "none"})`);
    try {
      const { page, pageSize, offset } = this.paginationDefaults(dto);

      const qb = this.authEventRepo.createQueryBuilder("ae");
      this.applyTenantScope(qb, "ae", dto);
      this.applyDateRange(qb, "ae", dto);

      if (dto.actorId) qb.andWhere("ae.user_id = :actorId", { actorId: dto.actorId });
      if (dto.search) qb.andWhere("ae.username_attempted ILIKE :search", { search: `%${dto.search}%` });

      const total = await qb.getCount();
      const rows = await qb.orderBy("ae.occurred_at", "DESC").addOrderBy("ae.id", "DESC").offset(offset).limit(pageSize).getMany();

      const items: AuthEventResponse[] = rows.map((row) => ({
        id: row.id,
        occurredAt: row.occurredAt.toISOString(),
        tenantId: row.tenantId,
        tenantName: row.tenantId, // resolved below in bulk
        eventType: row.eventType,
        reason: row.reason ?? null,
        userId: row.userId ?? null,
        usernameAttempted: row.usernameAttempted,
        ipAddress: row.ipAddress ?? null,
        userAgent: row.userAgent ?? null,
      }));

      await this.resolveTenantNames(items);

      this.logger.debug(`findAuthEvents returning ${items.length}/${total} row(s)`);
      return { items, total, page, pageSize };
    } catch (err) {
      this.logger.error(`findAuthEvents failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // /activity-log/filters -- actor/module (and, platform-only, tenant)
  // options actually present in the caller's scope, so a dropdown can never
  // offer a filter that returns nothing. Stays date-bounded by the same
  // window as the current filter (defaults to the last 30 days too) --
  // an unbounded SELECT DISTINCT over the whole table is the sneaky full
  // scan this page would otherwise ship with.
  async findFilterOptions(dto: QueryActivityLogDto): Promise<ActivityLogFilterOptionsResponse> {
    this.logger.debug("findFilterOptions called");
    try {
      const qb = this.auditLogRepo
        .createQueryBuilder("al")
        .leftJoin("users", "actor", "actor.id = al.actor_id")
        .select("DISTINCT al.actor_id", "actor_id")
        .addSelect("actor.display_name", "actor_name")
        .addSelect("al.entity_type", "entity_type")
        .addSelect("al.tenant_id", "tenant_id");
      this.applyTenantScope(qb, "al", dto);
      this.applyDateRange(qb, "al", dto);

      const rows = await qb.getRawMany();

      const actorMap = new Map<string, string>();
      const moduleSet = new Set<string>();
      const tenantIds = new Set<string>();
      for (const row of rows) {
        if (row.actor_id && row.actor_name) actorMap.set(row.actor_id, row.actor_name);
        if (row.entity_type) moduleSet.add(row.entity_type);
        if (row.tenant_id) tenantIds.add(row.tenant_id);
      }

      const result: ActivityLogFilterOptionsResponse = {
        actors: [...actorMap.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
        modules: [...moduleSet].map((value) => ({ value, label: value })).sort((a, b) => a.label.localeCompare(b.label)),
      };

      if (this.isPlatformSession()) {
        const tenantNames = await this.tenantNamesFor([...tenantIds]);
        result.tenants = [...tenantIds]
          .map((id) => ({ id, name: tenantNames.get(id) ?? id }))
          .sort((a, b) => a.name.localeCompare(b.name));
      }

      this.logger.debug(
        `findFilterOptions returning ${result.actors.length} actor(s), ${result.modules.length} module(s)${result.tenants ? `, ${result.tenants.length} tenant(s)` : ""}`,
      );
      return result;
    } catch (err) {
      this.logger.error(`findFilterOptions failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Bulk tenant-name resolution + in-place fill -- one query regardless of
  // page size, same "never per-row" rule as the actor-name join above.
  private async resolveTenantNames(items: { tenantId: string; tenantName: string }[]): Promise<void> {
    const ids = [...new Set(items.map((item) => item.tenantId))];
    const names = await this.tenantNamesFor(ids);
    for (const item of items) {
      item.tenantName = names.get(item.tenantId) ?? item.tenantId;
    }
  }

  private async tenantNamesFor(tenantIds: string[]): Promise<Map<string, string>> {
    if (tenantIds.length === 0) return new Map();
    const rows: { id: string; name: string }[] = await this.auditLogRepo.manager
      .createQueryBuilder()
      .select(["t.id AS id", "t.name AS name"])
      .from("tenants_registry", "t")
      .where("t.id IN (:...ids)", { ids: tenantIds })
      .getRawMany();
    return new Map(rows.map((row) => [row.id, row.name]));
  }
}
