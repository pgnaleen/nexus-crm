import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseTenantRepository, TenantContextService } from "../../core/tenant";
import { DashboardPreference } from "./entities/dashboard-preference.entity";

@Injectable()
export class DashboardPreferencesRepository extends BaseTenantRepository<DashboardPreference> {
  constructor(
    @InjectRepository(DashboardPreference) repo: Repository<DashboardPreference>,
    tenantContext: TenantContextService,
  ) {
    super(repo, tenantContext);
  }
}
