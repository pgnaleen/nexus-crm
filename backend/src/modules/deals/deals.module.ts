import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RbacModule } from "../rbac/rbac.module";
import { DealContactsMap } from "./entities/deal-contacts-map.entity";
import { DealDocument } from "./entities/deal-document.entity";
import { Deal } from "./entities/deal.entity";
import { DealContactsController } from "./deal-contacts.controller";
import { DealContactsService } from "./deal-contacts.service";
import { DealDocumentsController } from "./deal-documents.controller";
import { DealDocumentsService } from "./deal-documents.service";
import { DealsController } from "./deals.controller";
import { DealsRepository } from "./deals.repository";
import { DealsService } from "./deals.service";

@Module({
  imports: [TypeOrmModule.forFeature([Deal, DealDocument, DealContactsMap]), RbacModule],
  controllers: [DealsController, DealDocumentsController, DealContactsController],
  providers: [DealsService, DealsRepository, DealDocumentsService, DealContactsService],
})
export class DealsModule {}
