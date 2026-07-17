import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { envValidationSchema } from "./config/env.validation";
import { CoreModule } from "./core/core.module";
import { RequestLoggerMiddleware } from "./core/logging/request-logger.middleware";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./modules/auth/auth.module";
import { DealSourcesModule } from "./modules/deal-sources/deal-sources.module";
import { MainStagesModule } from "./modules/deal-stages/main-stages.module";
import { DepartmentsModule } from "./modules/departments/departments.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { RelationshipTypesModule } from "./modules/relationship-types/relationship-types.module";
import { TeamsModule } from "./modules/teams/teams.module";
import { TenantsModule } from "./modules/tenants/tenants.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    DatabaseModule,
    CoreModule,
    TenantsModule,
    UsersModule,
    RbacModule,
    TeamsModule,
    RelationshipTypesModule,
    DealSourcesModule,
    MainStagesModule,
    DepartmentsModule,
    AuthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes("*");
  }
}
