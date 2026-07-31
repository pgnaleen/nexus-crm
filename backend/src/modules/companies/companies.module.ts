import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CompaniesRepository } from "./companies.repository";
import { CompaniesService } from "./companies.service";
import { CompanyIndustry } from "./entities/company-industry.entity";
import { Company } from "./entities/company.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Company, CompanyIndustry])],
  providers: [CompaniesService, CompaniesRepository],
  exports: [CompaniesService],
})
export class CompaniesModule {}
