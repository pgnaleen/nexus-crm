import { Injectable, Logger } from "@nestjs/common";
import { Company } from "./entities/company.entity";
import { CompaniesRepository } from "./companies.repository";

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(private readonly companiesRepo: CompaniesRepository) {}

  async findPicker(search?: string, excludeId?: string): Promise<Company[]> {
    this.logger.debug(`findPicker called (search=${search ?? "none"}, excludeId=${excludeId ?? "none"})`);
    try {
      const qb = this.companiesRepo
        .queryBuilderScoped("company")
        .orderBy("company.name", "ASC")
        .take(20);

      if (search?.trim()) {
        this.logger.debug(`Applying name search filter: "${search.trim()}"`);
        qb.andWhere("company.name ILIKE :search", { search: `%${search.trim()}%` });
      } else {
        this.logger.debug("No search filter provided, returning unfiltered top 20");
      }

      if (excludeId) {
        this.logger.debug(`Excluding company id ${excludeId} from results`);
        qb.andWhere("company.id != :excludeId", { excludeId });
      }

      const results = await qb.getMany();
      this.logger.debug(`findPicker returning ${results.length} row(s)`);
      return results;
    } catch (err) {
      this.logger.error(`findPicker failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async findCountries(): Promise<string[]> {
    this.logger.debug("findCountries called");
    try {
      const countries = await this.companiesRepo.findDistinctCountries();
      this.logger.debug(`findCountries returning ${countries.length} distinct countrie(s)`);
      return countries;
    } catch (err) {
      this.logger.error(`findCountries failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
