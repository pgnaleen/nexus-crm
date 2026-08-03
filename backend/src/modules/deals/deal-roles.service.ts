import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { TenantContextService } from "../../core/tenant";
import { DealRole } from "./entities/deal-role.entity";

const AUDIT_ENTITY_TYPE = "deal_role";

// Deliberately minimal -- the entire "admin UI" for deal_roles is this
// find-all + create, no rename/deactivate/delete, per the lightweight-inline
// scope for this feature (see CLAUDE.md's Deal Team feature notes). Sales
// Person, Pre-Sales, and PMO are seeded per tenant (SeedDealRolesAndBackfill
// Assignments + TenantsService.create()); admins add further roles inline
// from the deal's Team tab via create() below.
@Injectable()
export class DealRolesService {
  private readonly logger = new Logger(DealRolesService.name);

  constructor(
    @InjectRepository(DealRole) private readonly repo: Repository<DealRole>,
    private readonly auditLogService: AuditLogService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAllForTenant(): Promise<DealRole[]> {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`findAllForTenant called for tenant ${tenantId}`);
    const roles = await this.repo.find({ where: { tenantId }, order: { name: "ASC" } });
    this.logger.debug(`findAllForTenant returning ${roles.length} role(s)`);
    return roles;
  }

  async create(name: string, userId: string): Promise<DealRole> {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`create called by ${userId} (name="${name}") for tenant ${tenantId}`);
    try {
      const role = this.repo.create({ tenantId, name, requiresPrimaryOnCreate: false, createdBy: userId });
      const saved = await this.repo.save(role);
      this.logger.debug(`create succeeded, role ${saved.id}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: saved.id,
        action: "insert",
        actorId: userId,
        changes: { name },
      });
      return saved;
    } catch (err) {
      this.logger.error(`create failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
