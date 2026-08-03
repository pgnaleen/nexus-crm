import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Tenant } from "../modules/tenants/entities/tenant.entity";
import { AuditLog } from "./audit-log/audit-log.entity";
import { AuditLogService } from "./audit-log/audit-log.service";
import { AuthEvent } from "./audit-log/auth-event.entity";
import { AuthEventService } from "./audit-log/auth-event.service";
import { MailService } from "./mail/mail.service";
import { RealtimeGateway, RealtimeService } from "./realtime";
import { S3Service } from "./storage/s3.service";
import { SystemTenantCache, TenantContextInterceptor, TenantContextService } from "./tenant";

@Global()
@Module({
  // Tenant + JwtModule registered here (already registered elsewhere too --
  // same pattern as RbacModule/UsersModule registering Tenant locally to
  // avoid a circular module import) so SystemTenantCache and
  // TenantContextInterceptor can use them without CoreModule depending on
  // TenantsModule/AuthModule. JwtModule.register({}) takes no secret here --
  // secrets are passed per sign()/verify() call, so re-registering it is
  // cheap and doesn't duplicate config (AuthModule already does the same).
  imports: [TypeOrmModule.forFeature([Tenant, AuditLog, AuthEvent]), JwtModule.register({})],
  providers: [
    TenantContextService,
    SystemTenantCache,
    AuditLogService,
    AuthEventService,
    S3Service,
    MailService,
    RealtimeGateway,
    RealtimeService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
  ],
  exports: [TenantContextService, SystemTenantCache, AuditLogService, AuthEventService, S3Service, MailService, RealtimeService],
})
export class CoreModule {}
