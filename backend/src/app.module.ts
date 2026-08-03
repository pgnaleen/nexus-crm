import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { envValidationSchema } from "./config/env.validation";
import { CoreModule } from "./core/core.module";
import { RequestLoggerMiddleware } from "./core/logging/request-logger.middleware";
import { DatabaseModule } from "./database/database.module";
import { ActivityLogModule } from "./modules/activity-log/activity-log.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CertificationsModule } from "./modules/certifications/certifications.module";
import { CompaniesModule } from "./modules/companies/companies.module";
import { ContactsModule } from "./modules/contacts/contacts.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { DbBackupModule } from "./modules/db-backup/db-backup.module";
import { DealSourcesModule } from "./modules/deal-sources/deal-sources.module";
import { MainStagesModule } from "./modules/deal-stages/main-stages.module";
import { DealsModule } from "./modules/deals/deals.module";
import { DepartmentsModule } from "./modules/departments/departments.module";
import { EmployeesModule } from "./modules/employees/employees.module";
import { IndustriesModule } from "./modules/industries/industries.module";
import { PickersModule } from "./modules/pickers/pickers.module";
import { PriorityTasksModule } from "./modules/priority-tasks/priority-tasks.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { RelationshipTypesModule } from "./modules/relationship-types/relationship-types.module";
import { TeamsModule } from "./modules/teams/teams.module";
import { TenantsModule } from "./modules/tenants/tenants.module";
import { UploadsModule } from "./modules/uploads/uploads.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    CoreModule,
    TenantsModule,
    UsersModule,
    RbacModule,
    TeamsModule,
    RelationshipTypesModule,
    DealSourcesModule,
    MainStagesModule,
    DealsModule,
    DepartmentsModule,
    CompaniesModule,
    ContactsModule,
    EmployeesModule,
    CertificationsModule,
    IndustriesModule,
    PickersModule,
    PriorityTasksModule,
    DashboardModule,
    UploadsModule,
    DbBackupModule,
    AuthModule,
    ActivityLogModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes("*");
  }
}
