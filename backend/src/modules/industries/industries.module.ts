import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Industry } from "../tenants/entities/industry.entity";
import { IndustriesService } from "./industries.service";

@Module({
  imports: [TypeOrmModule.forFeature([Industry])],
  providers: [IndustriesService],
  exports: [IndustriesService],
})
export class IndustriesModule {}
