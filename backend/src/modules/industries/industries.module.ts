import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Industry } from "../tenants/entities/industry.entity";
import { RbacModule } from "../rbac/rbac.module";
import { IndustriesController } from "./industries.controller";
import { IndustriesService } from "./industries.service";

@Module({
  imports: [TypeOrmModule.forFeature([Industry]), RbacModule],
  controllers: [IndustriesController],
  providers: [IndustriesService],
})
export class IndustriesModule {}
