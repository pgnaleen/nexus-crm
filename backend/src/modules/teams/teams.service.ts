import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { CreateTeamDto } from "./dto/create-team.dto";
import { UpdateTeamDto } from "./dto/update-team.dto";
import { Team } from "./entities/team.entity";
import { TeamsRepository } from "./teams.repository";

const AUDIT_ENTITY_TYPE = "team";

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(
    private readonly teamsRepo: TeamsRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(): Promise<Team[]> {
    this.logger.debug("findAll called");
    const results = await this.teamsRepo.findScoped({ order: { name: "ASC" } });
    this.logger.debug(`findAll returning ${results.length} row(s)`);
    return results;
  }

  async findOneOrFail(id: string): Promise<Team> {
    const team = await this.teamsRepo.findOneScoped({ where: { id } });
    if (!team) {
      throw new NotFoundException("Team not found");
    }
    return team;
  }

  async create(dto: CreateTeamDto, userId: string): Promise<Team> {
    this.logger.debug(`create called by ${userId} (name="${dto.name}")`);
    try {
      const team = this.teamsRepo.createScoped({ ...dto, createdBy: userId });
      const saved = await this.teamsRepo.saveScoped(team);
      this.logger.debug(`create succeeded for team ${saved.id}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: saved.id,
        action: "insert",
        actorId: userId,
        changes: { ...dto },
      });
      return saved;
    } catch (err) {
      this.logger.error(`create failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async update(id: string, dto: UpdateTeamDto, userId: string): Promise<Team> {
    this.logger.debug(`update called for team ${id} by ${userId}`);
    const team = await this.findOneOrFail(id);

    const before: Record<string, unknown> = {};
    const teamAsRecord = team as unknown as Record<string, unknown>;
    for (const key of Object.keys(dto)) {
      before[key] = teamAsRecord[key];
    }

    try {
      Object.assign(team, dto, { updatedBy: userId });
      await this.teamsRepo.saveScoped(team);
      // Re-fetch rather than return the in-memory object -- Object.assign copies
      // omitted dto fields as explicit `undefined`, which would misreport
      // untouched columns as missing in the API response (see rbac.service.ts).
      const updated = await this.findOneOrFail(id);
      this.logger.debug(`update succeeded for team ${id}`);

      const changes: Record<string, { old: unknown; new: unknown }> = {};
      const updatedAsRecord = updated as unknown as Record<string, unknown>;
      for (const key of Object.keys(dto)) {
        const newValue = updatedAsRecord[key];
        if (before[key] !== newValue) {
          changes[key] = { old: before[key], new: newValue };
        }
      }
      if (Object.keys(changes).length > 0) {
        await this.auditLogService.record({
          entityType: AUDIT_ENTITY_TYPE,
          entityId: id,
          action: "update",
          actorId: userId,
          changes,
        });
      }

      return updated;
    } catch (err) {
      this.logger.error(`update failed for team ${id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    this.logger.debug(`remove called for team ${id} by ${userId}`);
    const team = await this.findOneOrFail(id);
    try {
      await this.teamsRepo.softRemoveScoped(team, userId);
      this.logger.debug(`remove succeeded for team ${id}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: id,
        action: "delete",
        actorId: userId,
        changes: { name: team.name },
      });
    } catch (err) {
      this.logger.error(`remove failed for team ${id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
