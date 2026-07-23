import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CompaniesRepository } from "../companies/companies.repository";
import { Company } from "../companies/entities/company.entity";
import { ContactsRepository } from "../contacts/contacts.repository";
import { Contact } from "../contacts/entities/contact.entity";
import { MainStagesModule } from "../deal-stages/main-stages.module";
import { DealSourcesRepository } from "../deal-sources/deal-sources.repository";
import { DealSource } from "../deal-sources/entities/deal-source.entity";
import { DepartmentsRepository } from "../departments/departments.repository";
import { Department } from "../departments/entities/department.entity";
import { EmployeesRepository } from "../employees/employees.repository";
import { Employee } from "../employees/entities/employee.entity";
import { RbacModule } from "../rbac/rbac.module";
import { DealPartnersMap } from "./entities/deal-partners-map.entity";
import { DealDocument } from "./entities/deal-document.entity";
import { DealNote } from "./entities/deal-note.entity";
import { DealTenderDetails } from "./entities/deal-tender-details.entity";
import { Deal } from "./entities/deal.entity";
import { MainStageHistory } from "./entities/main-stage-history.entity";
import { SubStageHistory } from "./entities/sub-stage-history.entity";
import { DealPartnersController } from "./deal-partners.controller";
import { DealPartnersService } from "./deal-partners.service";
import { DealDocumentsController } from "./deal-documents.controller";
import { DealDocumentsService } from "./deal-documents.service";
import { DealNotesController } from "./deal-notes.controller";
import { DealNotesService } from "./deal-notes.service";
import { DealStageHistoryController } from "./deal-stage-history.controller";
import { DealStageHistoryService } from "./deal-stage-history.service";
import { DealTenderDetailsController } from "./deal-tender-details.controller";
import { DealTenderDetailsRepository } from "./deal-tender-details.repository";
import { DealTenderDetailsService } from "./deal-tender-details.service";
import { DealsController } from "./deals.controller";
import { DealsRepository } from "./deals.repository";
import { DealsService } from "./deals.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Deal,
      DealDocument,
      DealNote,
      DealPartnersMap,
      DealTenderDetails,
      SubStageHistory,
      MainStageHistory,
      Company,
      Contact,
      DealSource,
      Department,
      Employee,
    ]),
    RbacModule,
    MainStagesModule,
  ],
  controllers: [
    DealsController,
    DealDocumentsController,
    DealNotesController,
    DealPartnersController,
    DealStageHistoryController,
    DealTenderDetailsController,
  ],
  providers: [
    DealsService,
    DealsRepository,
    DealDocumentsService,
    DealNotesService,
    DealPartnersService,
    DealStageHistoryService,
    DealTenderDetailsService,
    DealTenderDetailsRepository,
    CompaniesRepository,
    ContactsRepository,
    DealSourcesRepository,
    DepartmentsRepository,
    EmployeesRepository,
  ],
})
export class DealsModule {}
