import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseTenantRepository, TenantContextService } from "../../core/tenant";
import { Deal } from "./entities/deal.entity";

@Injectable()
export class DealsRepository extends BaseTenantRepository<Deal> {
  constructor(
    @InjectRepository(Deal) repo: Repository<Deal>,
    tenantContext: TenantContextService,
  ) {
    super(repo, tenantContext);
  }

  findAllWithRelations(mainStageId?: string): Promise<Deal[]> {
    const qb = this.queryBuilderScoped("deal")
      .leftJoinAndSelect("deal.company", "company")
      .leftJoinAndSelect("deal.currentStage", "currentStage")
      .leftJoinAndSelect("deal.mainStage", "mainStage")
      .leftJoinAndSelect("deal.owner", "owner")
      .orderBy("deal.createdAt", "DESC");

    if (mainStageId) {
      qb.andWhere("deal.main_stage_id = :mainStageId", { mainStageId });
    }

    return qb.getMany();
  }

  findOneWithRelations(id: string): Promise<Deal | null> {
    return this.findOneScoped({
      where: { id },
      relations: ["company", "currentStage", "mainStage", "owner"],
    });
  }

  // Deal codes are a per-tenant running count, including soft-deleted deals,
  // so a code is never reused after a deal is deleted.
  async countAllScoped(): Promise<number> {
    return this.queryBuilderScoped("deal").withDeleted().getCount();
  }

  async softRemoveScoped(deal: Deal): Promise<void> {
    if (deal.tenantId !== this.tenantContext.getTenantId()) {
      throw new ForbiddenException("Entity does not belong to the current tenant");
    }
    await this.repo.softRemove(deal);
  }
}
