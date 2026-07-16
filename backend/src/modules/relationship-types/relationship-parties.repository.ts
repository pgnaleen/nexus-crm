import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseTenantRepository, TenantContextService } from "../../core/tenant";
import { RelationshipCompanyContactMap } from "./entities/relationship-company-contact-map.entity";

@Injectable()
export class RelationshipPartiesRepository extends BaseTenantRepository<RelationshipCompanyContactMap> {
  constructor(
    @InjectRepository(RelationshipCompanyContactMap) repo: Repository<RelationshipCompanyContactMap>,
    tenantContext: TenantContextService,
  ) {
    super(repo, tenantContext);
  }

  async softRemoveScoped(party: RelationshipCompanyContactMap): Promise<void> {
    if (party.tenantId !== this.tenantContext.getTenantId()) {
      throw new ForbiddenException("Entity does not belong to the current tenant");
    }
    await this.repo.softRemove(party);
  }
}
