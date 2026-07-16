import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseTenantRepository, TenantContextService } from "../../core/tenant";
import { Company } from "./entities/company.entity";

@Injectable()
export class CompaniesRepository extends BaseTenantRepository<Company> {
  constructor(
    @InjectRepository(Company) repo: Repository<Company>,
    tenantContext: TenantContextService,
  ) {
    super(repo, tenantContext);
  }
}
