import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseTenantRepository, TenantContextService } from "../../core/tenant";
import { Department } from "./entities/department.entity";

@Injectable()
export class DepartmentsRepository extends BaseTenantRepository<Department> {
  constructor(
    @InjectRepository(Department) repo: Repository<Department>,
    tenantContext: TenantContextService,
  ) {
    super(repo, tenantContext);
  }

  async softRemoveScoped(department: Department, actorId?: string): Promise<void> {
    if (department.tenantId !== this.tenantContext.getTenantId()) {
      throw new ForbiddenException("Entity does not belong to the current tenant");
    }
    await this.repo.softRemove(department);
    await this.repo.update(department.id, { deletedBy: actorId });
  }
}
