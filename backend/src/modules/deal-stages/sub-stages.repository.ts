import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseTenantRepository, TenantContextService } from "../../core/tenant";
import { SubStage } from "./entities/sub-stage.entity";

@Injectable()
export class SubStagesRepository extends BaseTenantRepository<SubStage> {
  constructor(
    @InjectRepository(SubStage) repo: Repository<SubStage>,
    tenantContext: TenantContextService,
  ) {
    super(repo, tenantContext);
  }

  async softRemoveScoped(subStage: SubStage, actorId?: string): Promise<void> {
    if (subStage.tenantId !== this.tenantContext.getTenantId()) {
      throw new ForbiddenException("Entity does not belong to the current tenant");
    }
    await this.repo.softRemove(subStage);
    await this.repo.update(subStage.id, { deletedBy: actorId });
  }

  // Used to warn the user how many Sub Stages a Main Stage deletion will
  // cascade-delete, before they confirm.
  countActiveForMainStage(mainStageId: string): Promise<number> {
    return this.queryBuilderScoped("subStage")
      .andWhere("subStage.main_stage_id = :mainStageId", { mainStageId })
      .getCount();
  }

  // Same as above but for a whole Main Stage list at once (one grouped query
  // instead of one count query per row).
  async countActiveGroupedByMainStage(mainStageIds: string[]): Promise<Map<string, number>> {
    if (mainStageIds.length === 0) {
      return new Map();
    }
    const rows = await this.queryBuilderScoped("subStage")
      .select("subStage.main_stage_id", "mainStageId")
      .addSelect("COUNT(*)", "count")
      .andWhere("subStage.main_stage_id IN (:...mainStageIds)", { mainStageIds })
      .groupBy("subStage.main_stage_id")
      .getRawMany<{ mainStageId: string; count: string }>();
    return new Map(rows.map((row) => [row.mainStageId, Number(row.count)]));
  }
}
