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
  // countries is a jsonb array, so DISTINCT has to run over the unnested
  // elements, not the column -- selecting the column itself would return one
  // row per distinct *array*, e.g. ["UK","France"] as a single opaque value.
  //
  // The unnesting happens in JS rather than SQL on purpose. The natural SQL is
  // a LATERAL jsonb_array_elements_text join, but TypeORM's query builder reads
  // a string join target as an entity/relation name and errors with
  // `relation "jsonb_array_elements_text(company.countries)" does not exist`.
  // Dropping to a raw query would mean re-implementing queryBuilderScoped's
  // tenant + soft-delete filters by hand -- a far worse trade for a picker that
  // already scanned this table. Blank entries are still filtered: pre-existing
  // rows can hold "" from before the form learned to omit empty values.
  async findDistinctCountries(): Promise<string[]> {
    const rows = await this.queryBuilderScoped("company")
      .select("company.countries", "countries")
      .andWhere("company.countries IS NOT NULL")
      .getRawMany<{ countries: string[] | null }>();
    const unique = new Set<string>();
    for (const row of rows) {
      for (const country of row.countries ?? []) {
        if (country?.trim()) unique.add(country);
      }
    }
    return [...unique].sort((a, b) => a.localeCompare(b));
  }
}
