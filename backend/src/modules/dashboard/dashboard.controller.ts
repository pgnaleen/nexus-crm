import { Body, Controller, Get, Logger, Put } from "@nestjs/common";
import { DashboardPreferenceResponse } from "@orelia/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { DashboardPreferencesService } from "./dashboard-preferences.service";
import { UpdateDashboardPreferenceDto } from "./dto/update-dashboard-preference.dto";

// No PermissionsGuard/RequirePermission -- the global JwtAuthGuard
// (authentication only) is the entire access rule, same as priority-tasks:
// every user reads and writes only their own dashboard preferences, never
// anyone else's, so there's no resource permission to gate on.
@Controller("dashboard")
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardPreferencesService: DashboardPreferencesService) {}

  @Get("preferences")
  async getPreferences(@CurrentUser() user: AuthenticatedUser): Promise<DashboardPreferenceResponse | null> {
    this.logger.debug(`GET /dashboard/preferences called by ${user.sub}`);
    try {
      const preferences = await this.dashboardPreferencesService.getForUser(user.sub);
      this.logger.debug(`GET /dashboard/preferences returning ${preferences ? "saved" : "null"} preferences`);
      return preferences;
    } catch (err) {
      this.logger.error(`GET /dashboard/preferences failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @Put("preferences")
  async updatePreferences(
    @Body() dto: UpdateDashboardPreferenceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DashboardPreferenceResponse> {
    this.logger.debug(
      `PUT /dashboard/preferences called by ${user.sub} (${dto.visibleWidgetKeys.length} visible widget(s))`,
    );
    try {
      const preferences = await this.dashboardPreferencesService.upsertForUser(user.sub, dto);
      this.logger.debug(`PUT /dashboard/preferences succeeded for ${user.sub}`);
      return preferences;
    } catch (err) {
      this.logger.error(`PUT /dashboard/preferences failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
