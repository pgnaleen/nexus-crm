import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RbacModule } from "../rbac/rbac.module";
import { MainStage } from "./entities/main-stage.entity";
import { SubStage } from "./entities/sub-stage.entity";
import { MainStagesController } from "./main-stages.controller";
import { MainStagesRepository } from "./main-stages.repository";
import { MainStagesService } from "./main-stages.service";
import { SubStagesController } from "./sub-stages.controller";
import { SubStagesRepository } from "./sub-stages.repository";
import { SubStagesService } from "./sub-stages.service";

@Module({
  imports: [TypeOrmModule.forFeature([MainStage, SubStage]), RbacModule],
  controllers: [MainStagesController, SubStagesController],
  providers: [MainStagesService, MainStagesRepository, SubStagesService, SubStagesRepository],
  exports: [MainStagesService, SubStagesService],
})
export class MainStagesModule {}
