import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseTenantRepository, TenantContextService } from "../../core/tenant";
import { RbacRole } from "./entities/rbac-role.entity";

@Injectable()
export class RbacRolesRepository extends BaseTenantRepository<RbacRole> {
  constructor(
    @InjectRepository(RbacRole) repo: Repository<RbacRole>,
    tenantContext: TenantContextService,
  ) {
    super(repo, tenantContext);
  }

  async softRemoveScoped(role: RbacRole): Promise<void> {
    if (role.tenantId !== this.tenantContext.getTenantId()) {
      throw new ForbiddenException("Entity does not belong to the current tenant");
    }
    await this.repo.softRemove(role);
  }
}
