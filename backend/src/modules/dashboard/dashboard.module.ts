import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DealPartnersMap } from "../deals/entities/deal-partners-map.entity";
import { Deal } from "../deals/entities/deal.entity";
import { MainStageHistory } from "../deals/entities/main-stage-history.entity";
import { SubStageHistory } from "../deals/entities/sub-stage-history.entity";
import { PriorityTaskFlow } from "../priority-tasks/entities/priority-task-flow.entity";
import { PriorityTask } from "../priority-tasks/entities/priority-task.entity";
import { RbacModule } from "../rbac/rbac.module";
import { RelationshipTypesModule } from "../relationship-types/relationship-types.module";
import { Tenant } from "../tenants/entities/tenant.entity";
import { DashboardMetricsController } from "./dashboard-metrics.controller";
import { DashboardMetricsService } from "./dashboard-metrics.service";
import { DashboardPreferencesRepository } from "./dashboard-preferences.repository";
import { DashboardPreferencesService } from "./dashboard-preferences.service";
import { DashboardController } from "./dashboard.controller";
import { DashboardPreference } from "./entities/dashboard-preference.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DashboardPreference,
      Deal,
      MainStageHistory,
      SubStageHistory,
      DealPartnersMap,
      Tenant,
      PriorityTask,
      PriorityTaskFlow,
    ]),
    RbacModule,
    RelationshipTypesModule,
  ],
  controllers: [DashboardController, DashboardMetricsController],
  providers: [DashboardPreferencesService, DashboardPreferencesRepository, DashboardMetricsService],
})
export class DashboardModule {}
