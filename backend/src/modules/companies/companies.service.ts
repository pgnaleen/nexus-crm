import { Injectable } from "@nestjs/common";
import { Company } from "./entities/company.entity";
import { CompaniesRepository } from "./companies.repository";

@Injectable()
export class CompaniesService {
  constructor(private readonly companiesRepo: CompaniesRepository) {}

  async findPicker(search?: string, excludeId?: string): Promise<Company[]> {
    const qb = this.companiesRepo
      .queryBuilderScoped("company")
      .orderBy("company.name", "ASC")
      .take(20);

    if (search?.trim()) {
      qb.andWhere("company.name ILIKE :search", { search: `%${search.trim()}%` });
    }
    if (excludeId) {
      qb.andWhere("company.id != :excludeId", { excludeId });
    }

    return qb.getMany();
  }
}
