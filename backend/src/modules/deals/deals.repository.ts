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
      .leftJoinAndSelect("deal.preSalesPerson", "preSalesPerson")
      .leftJoinAndSelect("deal.pmo", "pmo")
      .leftJoinAndSelect("deal.source", "source")
      .leftJoinAndSelect("deal.department", "department")
      .leftJoinAndSelect("deal.primaryContact", "primaryContact")
      .leftJoinAndSelect("deal.contact", "contact")
      .orderBy("deal.createdAt", "DESC");

    if (mainStageId) {
      qb.andWhere("deal.main_stage_id = :mainStageId", { mainStageId });
    }

    return qb.getMany();
  }

  // For display only -- see DealsService for why this must never be the
  // entity passed to save()/softRemove(). Loading relations and then saving
  // that same entity instance causes TypeORM to null out every
  // relation-backed FK column on the row, regardless of what actually
  // changed (confirmed empirically: reproduced with as few as one relation
  // loaded, gone entirely with zero relations loaded). Mutations must load
  // a bare entity via findOneScoped() instead, and re-fetch through this
  // method afterward only to build the response.
  findOneWithRelations(id: string): Promise<Deal | null> {
    return this.findOneScoped({
      where: { id },
      relations: [
        "company",
        "currentStage",
        "mainStage",
        "owner",
        "preSalesPerson",
        "pmo",
        "source",
        "department",
        "primaryContact",
        "contact",
      ],
    });
  }

  // Deal codes are a per-tenant running count, including soft-deleted deals,
  // so a code is never reused after a deal is deleted.
  async countAllScoped(): Promise<number> {
    return this.queryBuilderScoped("deal").withDeleted().getCount();
  }

  async softRemoveScoped(deal: Deal, actorId?: string): Promise<void> {
    if (deal.tenantId !== this.tenantContext.getTenantId()) {
      throw new ForbiddenException("Entity does not belong to the current tenant");
    }
    await this.repo.softRemove(deal);
    await this.repo.update(deal.id, { deletedBy: actorId });
  }
}
