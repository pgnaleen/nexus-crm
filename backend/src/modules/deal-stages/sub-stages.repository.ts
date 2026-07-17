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

  async softRemoveScoped(subStage: SubStage): Promise<void> {
    if (subStage.tenantId !== this.tenantContext.getTenantId()) {
      throw new ForbiddenException("Entity does not belong to the current tenant");
    }
    await this.repo.softRemove(subStage);
  }
}
