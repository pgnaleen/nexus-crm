import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { Deal } from "../deals/entities/deal.entity";
import { CreateSubStageDto } from "./dto/create-sub-stage.dto";
import { UpdateSubStageDto } from "./dto/update-sub-stage.dto";
import { SubStage } from "./entities/sub-stage.entity";
import { MainStagesService } from "./main-stages.service";
import { SubStagesRepository } from "./sub-stages.repository";

const AUDIT_ENTITY_TYPE = "sub_stage";

@Injectable()
export class SubStagesService {
  private readonly logger = new Logger(SubStagesService.name);

  constructor(
    private readonly subStagesRepo: SubStagesRepository,
    private readonly mainStagesService: MainStagesService,
    private readonly auditLogService: AuditLogService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<SubStage[]> {
    return this.subStagesRepo.findScoped({ order: { sortOrder: "ASC", name: "ASC" } });
  }

  async findOneOrFail(id: string): Promise<SubStage> {
    const subStage = await this.subStagesRepo.findOneScoped({ where: { id } });
    if (!subStage) {
      throw new NotFoundException("Sub stage not found");
    }
    return subStage;
  }

  // Scoped to the same Main Stage, not globally -- sortOrder only has to be
  // unambiguous among the sub-stages of one funnel column, per how
  // SubStagesWidget/FunnelBoard render and sort them.
  private async assertSortOrderAvailable(
    mainStageId: string,
    sortOrder: number,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.subStagesRepo.findOneScoped({ where: { mainStageId, sortOrder } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Sort order ${sortOrder} is already used by "${existing.name}" under this main stage`);
    }
  }

  async create(dto: CreateSubStageDto, userId: string): Promise<SubStage> {
    this.logger.debug(`create called by ${userId} (name="${dto.name}", mainStageId=${dto.mainStageId})`);
    // Ensures mainStageId genuinely belongs to the current tenant, not just
    // any UUID that happens to exist in main_stages across all tenants.
    await this.mainStagesService.findOneOrFail(dto.mainStageId);
    await this.assertSortOrderAvailable(dto.mainStageId, dto.sortOrder);
    try {
      const subStage = this.subStagesRepo.createScoped({ ...dto, createdBy: userId });
      const saved = await this.subStagesRepo.saveScoped(subStage);
      this.logger.debug(`create succeeded for sub stage ${saved.id}`);
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

  async update(id: string, dto: UpdateSubStageDto, userId: string): Promise<SubStage> {
    this.logger.debug(`update called for sub stage ${id} by ${userId}`);
    const subStage = await this.findOneOrFail(id);
    if (dto.mainStageId) {
      await this.mainStagesService.findOneOrFail(dto.mainStageId);
    }
    if (dto.sortOrder !== undefined || dto.mainStageId !== undefined) {
      await this.assertSortOrderAvailable(
        dto.mainStageId ?? subStage.mainStageId,
        dto.sortOrder ?? subStage.sortOrder,
        id,
      );
    }

    const before: Record<string, unknown> = {};
    const subStageAsRecord = subStage as unknown as Record<string, unknown>;
    for (const key of Object.keys(dto)) {
      before[key] = subStageAsRecord[key];
    }

    try {
      Object.assign(subStage, dto, { updatedBy: userId });
      await this.subStagesRepo.saveScoped(subStage);
      // Re-fetch rather than return the in-memory object -- Object.assign copies
      // omitted dto fields as explicit `undefined`, which would misreport
      // untouched columns as missing in the API response.
      const updated = await this.findOneOrFail(id);
      this.logger.debug(`update succeeded for sub stage ${id}`);

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
      this.logger.error(`update failed for sub stage ${id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Not a "records get deleted" cascade -- Deal.currentStageId is a required
  // column with no onDelete action, so leaving a Deal pointing at a
  // soft-deleted Sub Stage would be a dangling reference the Funnel board
  // can't render. Block instead of cascading; the admin has to move those
  // deals to a different stage first.
  async countActiveDeals(subStageId: string): Promise<number> {
    return this.dataSource.getRepository(Deal).count({ where: { currentStageId: subStageId } });
  }

  async remove(id: string, userId: string): Promise<void> {
    const subStage = await this.findOneOrFail(id);
    this.logger.debug(`remove called for sub stage ${id}`);

    // A ConflictException here is an expected business-rule rejection, not a
    // system failure -- deliberately thrown before the try/catch below so it
    // isn't logged as an error, same as NotFoundException elsewhere.
    const activeDealCount = await this.countActiveDeals(id);
    if (activeDealCount > 0) {
      this.logger.debug(`Blocked: ${activeDealCount} active deal(s) still reference this sub stage`);
      throw new ConflictException(
        `Cannot delete this sub-stage: ${activeDealCount} deal(s) are currently in it. Move them to a different stage first.`,
      );
    }

    try {
      await this.subStagesRepo.softRemoveScoped(subStage, userId);
      this.logger.debug(`remove succeeded for sub stage ${id}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: id,
        action: "delete",
        actorId: userId,
        changes: { name: subStage.name, mainStageId: subStage.mainStageId },
      });
    } catch (err) {
      this.logger.error(`remove failed for sub stage ${id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
