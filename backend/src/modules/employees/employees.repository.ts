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

  // Story 1.8 -- batch save for the org chart editor's "everything at
  // once" commit: all changed rows in a single transaction so a mid-batch
  // failure can't leave the reporting structure half-updated.
  async saveManyScoped(employees: Employee[]): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();
    for (const employee of employees) {
      if (employee.tenantId !== tenantId) {
        throw new ForbiddenException("Entity does not belong to the current tenant");
      }
    }
    await this.repo.manager.transaction(async (manager) => {
      for (const employee of employees) {
        await manager.save(employee);
      }
    });
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
