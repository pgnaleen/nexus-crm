import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CompaniesRepository } from "../companies/companies.repository";
import { Company } from "../companies/entities/company.entity";
import { ContactsRepository } from "../contacts/contacts.repository";
import { Contact } from "../contacts/entities/contact.entity";
import { MainStagesModule } from "../deal-stages/main-stages.module";
import { RbacModule } from "../rbac/rbac.module";
import { DealPartnersMap } from "./entities/deal-partners-map.entity";
import { DealDocument } from "./entities/deal-document.entity";
import { Deal } from "./entities/deal.entity";
import { MainStageHistory } from "./entities/main-stage-history.entity";
import { SubStageHistory } from "./entities/sub-stage-history.entity";
import { DealPartnersController } from "./deal-partners.controller";
import { DealPartnersService } from "./deal-partners.service";
import { DealDocumentsController } from "./deal-documents.controller";
import { DealDocumentsService } from "./deal-documents.service";
import { DealStageHistoryController } from "./deal-stage-history.controller";
import { DealStageHistoryService } from "./deal-stage-history.service";
import { DealsController } from "./deals.controller";
import { DealsRepository } from "./deals.repository";
import { DealsService } from "./deals.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Deal, DealDocument, DealPartnersMap, SubStageHistory, MainStageHistory, Company, Contact]),
    RbacModule,
    MainStagesModule,
  ],
  controllers: [
    DealsController,
    DealDocumentsController,
    DealPartnersController,
    DealStageHistoryController,
  ],
  providers: [
    DealsService,
    DealsRepository,
    DealDocumentsService,
    DealPartnersService,
    DealStageHistoryService,
    CompaniesRepository,
    ContactsRepository,
  ],
})
export class DealsModule {}
