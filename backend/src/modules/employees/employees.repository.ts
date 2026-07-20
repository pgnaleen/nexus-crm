import { Injectable } from "@nestjs/common";
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
}
