import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { Deal } from "../deals/entities/deal.entity";
import { CreateDealSourceDto } from "./dto/create-deal-source.dto";
import { UpdateDealSourceDto } from "./dto/update-deal-source.dto";
import { DealSource } from "./entities/deal-source.entity";
import { DealSourcesRepository } from "./deal-sources.repository";

const AUDIT_ENTITY_TYPE = "deal_source";

@Injectable()
export class DealSourcesService {
  private readonly logger = new Logger(DealSourcesService.name);

  constructor(
    private readonly dealSourcesRepo: DealSourcesRepository,
    private readonly auditLogService: AuditLogService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<DealSource[]> {
    this.logger.debug("findAll called");
    const results = await this.dealSourcesRepo.findScoped({ order: { name: "ASC" } });
    this.logger.debug(`findAll returning ${results.length} row(s)`);
    return results;
  }

  async findOneOrFail(id: string): Promise<DealSource> {
    const source = await this.dealSourcesRepo.findOneScoped({ where: { id } });
    if (!source) {
      throw new NotFoundException("Deal source not found");
    }
    return source;
  }

  async create(dto: CreateDealSourceDto, userId: string): Promise<DealSource> {
    this.logger.debug(`create called by ${userId} (name="${dto.name}")`);
    try {
      const source = this.dealSourcesRepo.createScoped({ ...dto, createdBy: userId });
      const saved = await this.dealSourcesRepo.saveScoped(source);
      this.logger.debug(`create succeeded for deal source ${saved.id}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: saved.id,
        action: "insert",
        actorId: userId,
        changes: { ...dto },
      });
      return saved;
    } catch (err) {
      this.logger.error(`create failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async update(id: string, dto: UpdateDealSourceDto, userId: string): Promise<DealSource> {
    this.logger.debug(`update called for deal source ${id} by ${userId}`);
    const source = await this.findOneOrFail(id);

    const before: Record<string, unknown> = {};
    const sourceAsRecord = source as unknown as Record<string, unknown>;
    for (const key of Object.keys(dto)) {
      before[key] = sourceAsRecord[key];
    }

    try {
      Object.assign(source, dto, { updatedBy: userId });
      await this.dealSourcesRepo.saveScoped(source);
      // Re-fetch rather than return the in-memory object -- Object.assign copies
      // omitted dto fields as explicit `undefined`, which would misreport
      // untouched columns as missing in the API response (see rbac.service.ts).
      const updated = await this.findOneOrFail(id);
      this.logger.debug(`update succeeded for deal source ${id}`);

      const changes: Record<string, { old: unknown; new: unknown }> = {};
      const updatedAsRecord = updated as unknown as Record<string, unknown>;
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
          actorId: userId,
          changes,
        });
      }

      return updated;
    } catch (err) {
      this.logger.error(`update failed for deal source ${id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Deal.sourceId has a DB-level ON DELETE SET NULL, but that only fires on a
  // real DELETE -- this delete is a soft-delete, so the FK action never
  // actually runs. Without this check a deal would be left silently pointing
  // at a now-hidden, soft-deleted Deal Source.
  async countActiveDeals(sourceId: string): Promise<number> {
    return this.dataSource.getRepository(Deal).count({ where: { sourceId } });
  }

  async remove(id: string, userId: string): Promise<void> {
    this.logger.debug(`remove called for deal source ${id} by ${userId}`);
    const source = await this.findOneOrFail(id);

    // A ConflictException here is an expected business-rule rejection, not a
    // system failure -- thrown before the try/catch below so it isn't logged
    // as an error, same as NotFoundException elsewhere.
    const activeDealCount = await this.countActiveDeals(id);
    if (activeDealCount > 0) {
      this.logger.debug(`Blocked: ${activeDealCount} active deal(s) still use this deal source`);
      throw new ConflictException(
        `Cannot delete this deal source: ${activeDealCount} deal(s) are currently using it. Reassign them to a different source first.`,
      );
    }

    try {
      await this.dealSourcesRepo.softRemoveScoped(source, userId);
      this.logger.debug(`remove succeeded for deal source ${id}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: id,
        action: "delete",
        actorId: userId,
        changes: { name: source.name },
      });
    } catch (err) {
      this.logger.error(`remove failed for deal source ${id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
