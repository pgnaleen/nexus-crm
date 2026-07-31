import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CompaniesRepository } from "../companies/companies.repository";
import { CompanyIndustry } from "../companies/entities/company-industry.entity";
import { Company } from "../companies/entities/company.entity";
import { ContactsRepository } from "../contacts/contacts.repository";
import { Contact } from "../contacts/entities/contact.entity";
import { Department } from "../departments/entities/department.entity";
import { DocumentsModule } from "../documents/documents.module";
import { Employee } from "../employees/entities/employee.entity";
import { Industry } from "../tenants/entities/industry.entity";
import { RbacModule } from "../rbac/rbac.module";
import { RelationshipCompanyContactMap } from "./entities/relationship-company-contact-map.entity";
import { RelationshipType } from "./entities/relationship-type.entity";
import { RelationshipPartiesController } from "./relationship-parties.controller";
import { RelationshipPartiesRepository } from "./relationship-parties.repository";
import { RelationshipPartiesService } from "./relationship-parties.service";
import { RelationshipTagsController } from "./relationship-tags.controller";
import { RelationshipTypesController } from "./relationship-types.controller";
import { RelationshipTypesRepository } from "./relationship-types.repository";
import { RelationshipTypesService } from "./relationship-types.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RelationshipType,
      RelationshipCompanyContactMap,
      Company,
      CompanyIndustry,
      Industry,
      Contact,
      Employee,
      Department,
    ]),
    RbacModule,
    DocumentsModule,
  ],
  controllers: [RelationshipTypesController, RelationshipPartiesController, RelationshipTagsController],
  providers: [
    RelationshipTypesService,
    RelationshipTypesRepository,
    RelationshipPartiesService,
    RelationshipPartiesRepository,
    CompaniesRepository,
    ContactsRepository,
  ],
  exports: [RelationshipTypesService],
})
export class RelationshipTypesModule {}
