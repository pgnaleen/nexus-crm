import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RbacModule } from "../rbac/rbac.module";
import { DealSource } from "./entities/deal-source.entity";
import { DealSourcesController } from "./deal-sources.controller";
import { DealSourcesRepository } from "./deal-sources.repository";
import { DealSourcesService } from "./deal-sources.service";

@Module({
  imports: [TypeOrmModule.forFeature([DealSource]), RbacModule],
  controllers: [DealSourcesController],
  providers: [DealSourcesService, DealSourcesRepository],
})
export class DealSourcesModule {}
