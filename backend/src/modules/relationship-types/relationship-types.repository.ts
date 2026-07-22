import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseTenantRepository, TenantContextService } from "../../core/tenant";
import { RelationshipType } from "./entities/relationship-type.entity";

@Injectable()
export class RelationshipTypesRepository extends BaseTenantRepository<RelationshipType> {
  constructor(
    @InjectRepository(RelationshipType) repo: Repository<RelationshipType>,
    tenantContext: TenantContextService,
  ) {
    super(repo, tenantContext);
  }

  async softRemoveScoped(type: RelationshipType, actorId?: string): Promise<void> {
    if (type.tenantId !== this.tenantContext.getTenantId()) {
      throw new ForbiddenException("Entity does not belong to the current tenant");
    }
    await this.repo.softRemove(type);
    await this.repo.update(type.id, { deletedBy: actorId });
  }
}
