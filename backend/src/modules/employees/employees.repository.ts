import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseTenantRepository, TenantContextService } from "../../core/tenant";
import { Employee } from "./entities/employee.entity";

@Injectable()
export class EmployeesRepository extends BaseTenantRepository<Employee> {
  constructor(
    @InjectRepository(Employee) repo: Repository<Employee>,
    tenantContext: TenantContextService,
  ) {
    super(repo, tenantContext);
  }

  // Story 1.5 -- same two-step softRemove()+update() pattern as
  // teams.repository.ts: soft-delete sets deletedAt, the follow-up update
  // stamps deletedBy (softRemove alone has nowhere to carry the actor).
  async softRemoveScoped(employee: Employee, actorId?: string): Promise<void> {
    if (employee.tenantId !== this.tenantContext.getTenantId()) {
      throw new ForbiddenException("Entity does not belong to the current tenant");
    }
    await this.repo.softRemove(employee);
    await this.repo.update(employee.id, { deletedBy: actorId });
  }
}
