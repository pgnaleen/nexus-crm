import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DashboardController } from "./dashboard.controller";
import { DashboardPreferencesRepository } from "./dashboard-preferences.repository";
import { DashboardPreferencesService } from "./dashboard-preferences.service";
import { DashboardPreference } from "./entities/dashboard-preference.entity";

@Module({
  imports: [TypeOrmModule.forFeature([DashboardPreference])],
  controllers: [DashboardController],
  providers: [DashboardPreferencesService, DashboardPreferencesRepository],
})
export class DashboardModule {}
