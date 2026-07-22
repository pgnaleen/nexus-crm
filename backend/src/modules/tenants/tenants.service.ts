import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";
import { Industry } from "./entities/industry.entity";
import { Plan } from "./entities/plan.entity";
import { Tenant } from "./entities/tenant.entity";

const AUDIT_ENTITY_TYPE = "tenant";

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    @InjectRepository(Industry) private readonly industryRepo: Repository<Industry>,
    private readonly auditLogService: AuditLogService,
  ) {}

  findAllPlans(): Promise<Plan[]> {
    this.logger.debug("findAllPlans called");
    return this.planRepo.find({ order: { name: "ASC" } });
  }

  findAllIndustries(): Promise<Industry[]> {
    this.logger.debug("findAllIndustries called");
    return this.industryRepo.find({ order: { name: "ASC" } });
  }

  async findBySlugOrFail(slug: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOneBy({ slug });
    if (!tenant) {
      throw new NotFoundException("Workspace not found");
    }
    return tenant;
  }

  findAll(): Promise<Tenant[]> {
    this.logger.debug("findAll called");
    return this.tenantRepo.find({ relations: ["plan", "industry"], order: { name: "ASC" } });
  }

  async findOneOrFail(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({
      where: { id },
      relations: ["plan", "industry"],
    });
    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }
    return tenant;
  }

  async create(dto: CreateTenantDto, createdBy: string): Promise<Tenant> {
    this.logger.debug(`create called by ${createdBy} (name="${dto.name}", slug="${dto.slug}")`);
    await this.assertSlugAvailable(dto.slug);
    try {
      const tenant = this.tenantRepo.create({ ...dto, createdBy });
      const saved = await this.tenantRepo.save(tenant);
      this.logger.debug(`create succeeded for tenant ${saved.id}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: saved.id,
        action: "insert",
        actorId: createdBy,
        changes: { ...dto },
      });
      return saved;
    } catch (err) {
      this.logger.error(`create failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async update(id: string, dto: UpdateTenantDto, updatedBy: string): Promise<Tenant> {
    this.logger.debug(`update called for tenant ${id} by ${updatedBy}`);
    const tenant = await this.findOneOrFail(id);
    if (dto.slug && dto.slug !== tenant.slug) {
      this.logger.debug(`update: slug changing from "${tenant.slug}" to "${dto.slug}", checking availability`);
      await this.assertSlugAvailable(dto.slug);
    }

    const before: Record<string, unknown> = {};
    const tenantAsRecord = tenant as unknown as Record<string, unknown>;
    for (const key of Object.keys(dto)) {
      before[key] = tenantAsRecord[key];
    }

    try {
      Object.assign(tenant, dto, { updatedBy });
      const saved = await this.tenantRepo.save(tenant);
      this.logger.debug(`update succeeded for tenant ${id}`);

      const changes: Record<string, { old: unknown; new: unknown }> = {};
      const updatedAsRecord = saved as unknown as Record<string, unknown>;
      for (const key of Object.keys(dto)) {
        const newValue = updatedAsRecord[key];
        if (before[key] !== newValue) {
          changes[key] = { old: before[key], new: newValue };
        }
      }
      if (Object.keys(changes).length > 0) {
        await this.auditLogService.record({
          entityType: AUDIT_ENTITY_TYPE,
          entityId: id,
          action: "update",
          actorId: updatedBy,
          changes,
        });
      }

      return saved;
    } catch (err) {
      this.logger.error(`update failed for tenant ${id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async remove(id: string, actorId: string): Promise<void> {
    this.logger.debug(`remove called for tenant ${id} by ${actorId}`);
    const tenant = await this.findOneOrFail(id);
    try {
      // Permanently deleting a tenant cascades: every tenant-owned table (teams,
      // users, deals, etc.) has ON DELETE CASCADE on its tenant_id FK, so this
      // wipes all of that tenant's data, not just the registry row. A genuine
      // hard delete (no deletedBy column applies), same shape as
      // deal-partners.service.ts's own hard-delete path.
      await this.tenantRepo.remove(tenant);
      this.logger.debug(`remove succeeded for tenant ${id} (hard delete, cascaded)`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: id,
        action: "delete",
        actorId,
        changes: { name: tenant.name, slug: tenant.slug },
      });
    } catch (err) {
      this.logger.error(`remove failed for tenant ${id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  private async assertSlugAvailable(slug: string): Promise<void> {
    const existing = await this.tenantRepo.findOneBy({ slug });
    if (existing) {
      throw new ConflictException(`Slug "${slug}" is already in use`);
    }
  }
}
