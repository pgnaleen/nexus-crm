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

  // The companies picker caps results at 20, so it can't be relied on for a
  // complete country list -- this queries distinct values directly instead.
  async findDistinctCountries(): Promise<string[]> {
    const rows = await this.queryBuilderScoped("company")
      .select("DISTINCT company.country", "country")
      .andWhere("company.country IS NOT NULL")
      .andWhere("company.country != ''")
      .orderBy("company.country", "ASC")
      .getRawMany<{ country: string }>();
    return rows.map((row) => row.country);
  }
}
