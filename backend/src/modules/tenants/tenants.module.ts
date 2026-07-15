import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RbacModule } from "../rbac/rbac.module";
import { Industry } from "./entities/industry.entity";
import { Plan } from "./entities/plan.entity";
import { Tenant } from "./entities/tenant.entity";
import { TenantsController } from "./tenants.controller";
import { TenantsService } from "./tenants.service";

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, Plan, Industry]), RbacModule],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TypeOrmModule],
})
export class TenantsModule {}
