import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, In } from "typeorm";
import { Deal } from "../deals/entities/deal.entity";
import { CreateMainStageDto } from "./dto/create-main-stage.dto";
import { UpdateMainStageDto } from "./dto/update-main-stage.dto";
import { MainStage } from "./entities/main-stage.entity";
import { SubStage } from "./entities/sub-stage.entity";
import { MainStagesRepository } from "./main-stages.repository";
import { SubStagesRepository } from "./sub-stages.repository";

@Injectable()
export class MainStagesService {
  private readonly logger = new Logger(MainStagesService.name);

  constructor(
    private readonly mainStagesRepo: MainStagesRepository,
    private readonly subStagesRepo: SubStagesRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<MainStage[]> {
    return this.mainStagesRepo.findScoped({ order: { position: "ASC", name: "ASC" } });
  }

  // Bundles each stage with its live Sub Stage count in one extra grouped
  // query, instead of one count query per row.
  async findAllWithDependentCounts(): Promise<Array<{ stage: MainStage; dependentCount: number }>> {
    const stages = await this.findAll();
    const counts = await this.subStagesRepo.countActiveGroupedByMainStage(stages.map((stage) => stage.id));
    return stages.map((stage) => ({ stage, dependentCount: counts.get(stage.id) ?? 0 }));
  }

  async findOneOrFail(id: string): Promise<MainStage> {
    const stage = await this.mainStagesRepo.findOneScoped({ where: { id } });
    if (!stage) {
      throw new NotFoundException("Main stage not found");
    }
    return stage;
  }

  countDependents(id: string): Promise<number> {
    return this.subStagesRepo.countActiveForMainStage(id);
  }

  async create(dto: CreateMainStageDto, userId: string): Promise<MainStage> {
    const stage = this.mainStagesRepo.createScoped({ ...dto, createdBy: userId });
    return this.mainStagesRepo.saveScoped(stage);
  }

  async update(id: string, dto: UpdateMainStageDto, userId: string): Promise<MainStage> {
    const stage = await this.findOneOrFail(id);
    Object.assign(stage, dto, { updatedBy: userId });
    await this.mainStagesRepo.saveScoped(stage);
    // Re-fetch rather than return the in-memory object -- Object.assign copies
    // omitted dto fields as explicit `undefined`, which would misreport
    // untouched columns as missing in the API response (see rbac.service.ts).
    return this.findOneOrFail(id);
  }

  // Cascades to every Sub Stage under this Main Stage, per CLAUDE.md's
  // cascade-delete rule -- done explicitly here, in one transaction, rather
  // than relying on the raw DB-level ON DELETE CASCADE on sub_stages
  // (which only fires on a hard DELETE and would never run for our
  // soft-deletes). Blocked entirely if any Deal is currently sitting in one
  // of those Sub Stages -- Deal.currentStageId is required with no onDelete
  // action, so cascading past it would leave a dangling reference.
  async remove(id: string, userId: string): Promise<void> {
    const stage = await this.findOneOrFail(id);
    this.logger.debug(`remove called for main stage ${id}`);

    const subStages = await this.subStagesRepo.findScoped({ where: { mainStageId: id } });
    this.logger.debug(`Found ${subStages.length} sub-stage(s) under this main stage`);
    const subStageIds = subStages.map((subStage) => subStage.id);

    if (subStageIds.length > 0) {
      const activeDealCount = await this.dataSource.getRepository(Deal).count({
        where: { currentStageId: In(subStageIds) },
      });
      this.logger.debug(`Active deals sitting in one of these sub-stages: ${activeDealCount}`);
      if (activeDealCount > 0) {
        throw new ConflictException(
          `Cannot delete this main stage: ${activeDealCount} deal(s) are currently in one of its sub-stages. Move them to a different stage first.`,
        );
      }
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        const subStageRepo = manager.getRepository(SubStage);
        const mainStageRepo = manager.getRepository(MainStage);

        if (subStages.length > 0) {
          this.logger.debug(`Cascading soft-delete to ${subStages.length} sub-stage(s)`);
          await subStageRepo.softRemove(subStages);
          await subStageRepo.update(subStageIds, { deletedBy: userId });
        } else {
          this.logger.debug("No sub-stages to cascade -- deleting the main stage alone");
        }

        await mainStageRepo.softRemove(stage);
        await mainStageRepo.update(stage.id, { deletedBy: userId });
      });
      this.logger.debug(`remove succeeded for main stage ${id}`);
    } catch (err) {
      this.logger.error(`remove failed for main stage ${id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
