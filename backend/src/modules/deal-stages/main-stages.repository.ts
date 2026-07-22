import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseTenantRepository, TenantContextService } from "../../core/tenant";
import { MainStage } from "./entities/main-stage.entity";

@Injectable()
export class MainStagesRepository extends BaseTenantRepository<MainStage> {
  constructor(
    @InjectRepository(MainStage) repo: Repository<MainStage>,
    tenantContext: TenantContextService,
  ) {
    super(repo, tenantContext);
  }

  async softRemoveScoped(stage: MainStage, actorId?: string): Promise<void> {
    if (stage.tenantId !== this.tenantContext.getTenantId()) {
      throw new ForbiddenException("Entity does not belong to the current tenant");
    }
    await this.repo.softRemove(stage);
    await this.repo.update(stage.id, { deletedBy: actorId });
  }
}
