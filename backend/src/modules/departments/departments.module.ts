import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RbacModule } from "../rbac/rbac.module";
import { Department } from "./entities/department.entity";
import { DepartmentsController } from "./departments.controller";
import { DepartmentsRepository } from "./departments.repository";
import { DepartmentsService } from "./departments.service";

@Module({
  imports: [TypeOrmModule.forFeature([Department]), RbacModule],
  controllers: [DepartmentsController],
  providers: [DepartmentsService, DepartmentsRepository],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
