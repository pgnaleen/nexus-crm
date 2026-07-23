import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseTenantRepository, TenantContextService } from "../../core/tenant";
import { PriorityTask } from "./entities/priority-task.entity";

@Injectable()
export class PriorityTasksRepository extends BaseTenantRepository<PriorityTask> {
  constructor(
    @InjectRepository(PriorityTask) repo: Repository<PriorityTask>,
    tenantContext: TenantContextService,
  ) {
    super(repo, tenantContext);
  }
}
