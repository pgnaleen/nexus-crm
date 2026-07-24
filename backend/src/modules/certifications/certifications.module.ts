import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EmployeesModule } from "../employees/employees.module";
import { CertificationsController } from "./certifications.controller";
import { CertificationsRepository } from "./certifications.repository";
import { CertificationsService } from "./certifications.service";
import { EmployeeCertification } from "./entities/employee-certification.entity";

@Module({
  // EmployeesModule: the caller's own employee is resolved from their user id
  // (EmployeesService.findByUserId) on every self-service route. AuditLogService
  // comes from the global CoreModule, no import needed.
  imports: [TypeOrmModule.forFeature([EmployeeCertification]), EmployeesModule],
  controllers: [CertificationsController],
  providers: [CertificationsService, CertificationsRepository],
  exports: [CertificationsService],
})
export class CertificationsModule {}
