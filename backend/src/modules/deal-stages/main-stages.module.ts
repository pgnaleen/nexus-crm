import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RbacModule } from "../rbac/rbac.module";
import { MainStage } from "./entities/main-stage.entity";
import { MainStagesController } from "./main-stages.controller";
import { MainStagesRepository } from "./main-stages.repository";
import { MainStagesService } from "./main-stages.service";

@Module({
  imports: [TypeOrmModule.forFeature([MainStage]), RbacModule],
  controllers: [MainStagesController],
  providers: [MainStagesService, MainStagesRepository],
})
export class MainStagesModule {}
