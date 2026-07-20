import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MainStagesModule } from "../deal-stages/main-stages.module";
import { RbacModule } from "../rbac/rbac.module";
import { DealContactsMap } from "./entities/deal-contacts-map.entity";
import { DealDocument } from "./entities/deal-document.entity";
import { Deal } from "./entities/deal.entity";
import { MainStageHistory } from "./entities/main-stage-history.entity";
import { SubStageHistory } from "./entities/sub-stage-history.entity";
import { DealContactsController } from "./deal-contacts.controller";
import { DealContactsService } from "./deal-contacts.service";
import { DealDocumentsController } from "./deal-documents.controller";
import { DealDocumentsService } from "./deal-documents.service";
import { DealStageHistoryController } from "./deal-stage-history.controller";
import { DealStageHistoryService } from "./deal-stage-history.service";
import { DealsController } from "./deals.controller";
import { DealsRepository } from "./deals.repository";
import { DealsService } from "./deals.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Deal, DealDocument, DealContactsMap, SubStageHistory, MainStageHistory]),
    RbacModule,
    MainStagesModule,
  ],
  controllers: [
    DealsController,
    DealDocumentsController,
    DealContactsController,
    DealStageHistoryController,
  ],
  providers: [DealsService, DealsRepository, DealDocumentsService, DealContactsService, DealStageHistoryService],
})
export class DealsModule {}
