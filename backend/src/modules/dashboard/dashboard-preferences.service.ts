import { Injectable, Logger } from "@nestjs/common";
import { DashboardPreferenceResponse } from "@orelia/common";
import { DashboardPreferencesRepository } from "./dashboard-preferences.repository";
import { UpdateDashboardPreferenceDto } from "./dto/update-dashboard-preference.dto";

@Injectable()
export class DashboardPreferencesService {
  private readonly logger = new Logger(DashboardPreferencesService.name);

  constructor(private readonly repo: DashboardPreferencesRepository) {}

  // Returns null when the user has never saved a layout yet -- the frontend
  // falls back to the widget registry's default layout/visibility in that
  // case, same "no row yet = use the default" convention as everywhere else
  // a per-user row is optional.
  async getForUser(userId: string): Promise<DashboardPreferenceResponse | null> {
    this.logger.debug(`getForUser called (userId=${userId})`);
    try {
      const row = await this.repo.findOneScoped({ where: { userId } });
      if (!row) {
        this.logger.debug(`No saved dashboard preferences for ${userId}, returning null`);
        return null;
      }
      this.logger.debug(`getForUser returning saved preferences for ${userId}`);
      return { visibleWidgetKeys: row.visibleWidgetKeys, layout: row.layout };
    } catch (err) {
      this.logger.error(`getForUser failed for ${userId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Upsert: one row per (tenant, user). A bare (no relations) load-then-save,
  // per the TypeORM save() rule elsewhere in this codebase -- this entity
  // never loads with relations anyway, but keeping the same shape.
  async upsertForUser(userId: string, dto: UpdateDashboardPreferenceDto): Promise<DashboardPreferenceResponse> {
    this.logger.debug(
      `upsertForUser called (userId=${userId}, ${dto.visibleWidgetKeys.length} visible widget(s), ${dto.layout.length} layout item(s))`,
    );
    try {
      const existing = await this.repo.findOneScoped({ where: { userId } });
      if (existing) {
        this.logger.debug(`Updating existing dashboard preferences row for ${userId}`);
        existing.visibleWidgetKeys = dto.visibleWidgetKeys;
        existing.layout = dto.layout;
        existing.updatedBy = userId;
        const saved = await this.repo.saveScoped(existing);
        this.logger.debug(`upsertForUser succeeded (update) for ${userId}`);
        return { visibleWidgetKeys: saved.visibleWidgetKeys, layout: saved.layout };
      }

      this.logger.debug(`No existing row for ${userId}, creating a new one`);
      const created = this.repo.createScoped({
        userId,
        visibleWidgetKeys: dto.visibleWidgetKeys,
        layout: dto.layout,
        createdBy: userId,
        updatedBy: userId,
      });
      const saved = await this.repo.saveScoped(created);
      this.logger.debug(`upsertForUser succeeded (create) for ${userId}`);
      return { visibleWidgetKeys: saved.visibleWidgetKeys, layout: saved.layout };
    } catch (err) {
      this.logger.error(`upsertForUser failed for ${userId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
