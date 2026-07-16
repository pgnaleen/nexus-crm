import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseTenantRepository, TenantContextService } from "../../core/tenant";
import { DealSource } from "./entities/deal-source.entity";

@Injectable()
export class DealSourcesRepository extends BaseTenantRepository<DealSource> {
  constructor(
    @InjectRepository(DealSource) repo: Repository<DealSource>,
    tenantContext: TenantContextService,
  ) {
    super(repo, tenantContext);
  }

  async softRemoveScoped(source: DealSource): Promise<void> {
    if (source.tenantId !== this.tenantContext.getTenantId()) {
      throw new ForbiddenException("Entity does not belong to the current tenant");
    }
    await this.repo.softRemove(source);
  }
}
