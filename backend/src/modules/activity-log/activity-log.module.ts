import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLog } from "../../core/audit-log/audit-log.entity";
import { AuthEvent } from "../../core/audit-log/auth-event.entity";
import { RbacModule } from "../rbac/rbac.module";
import { ActivityLogController } from "./activity-log.controller";
import { ActivityLogService } from "./activity-log.service";

// AuditLog/AuthEvent are already registered in CoreModule (@Global()), but
// CoreModule doesn't re-export TypeOrmModule itself -- same reasoning
// RbacModule/TenantsModule already document for Tenant, so this module
// re-registers both here too rather than depending on CoreModule's own
// internal wiring.
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, AuthEvent]), RbacModule],
  controllers: [ActivityLogController],
  providers: [ActivityLogService],
})
export class ActivityLogModule {}
