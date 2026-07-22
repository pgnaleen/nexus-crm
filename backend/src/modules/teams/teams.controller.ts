import { PERMISSIONS, TeamResponse } from "@orelia/common";
import { Body, Controller, Delete, Get, Logger, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { CreateTeamDto } from "./dto/create-team.dto";
import { UpdateTeamDto } from "./dto/update-team.dto";
import { Team } from "./entities/team.entity";
import { TeamsService } from "./teams.service";

@Controller("teams")
export class TeamsController {
  private readonly logger = new Logger(TeamsController.name);

  constructor(private readonly teamsService: TeamsService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.TEAMS_VIEW)
  @Get()
  async findAll(): Promise<TeamResponse[]> {
    this.logger.debug("GET /teams called");
    try {
      const teams = await this.teamsService.findAll();
      this.logger.debug(`GET /teams returning ${teams.length} row(s)`);
      return teams.map((team) => this.toResponse(team));
    } catch (err) {
      this.logger.error(`GET /teams failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.TEAMS_CREATE)
  @Post()
  async create(
    @Body() dto: CreateTeamDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeamResponse> {
    this.logger.debug(`POST /teams called by ${user.sub} (name="${dto.name}")`);
    try {
      const team = await this.teamsService.create(dto, user.sub);
      this.logger.debug(`POST /teams succeeded for team ${team.id}`);
      return this.toResponse(team);
    } catch (err) {
      this.logger.error(`POST /teams failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.TEAMS_UPDATE)
  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeamResponse> {
    this.logger.debug(`PATCH /teams/${id} called by ${user.sub}`);
    try {
      const team = await this.teamsService.update(id, dto, user.sub);
      this.logger.debug(`PATCH /teams/${id} succeeded`);
      return this.toResponse(team);
    } catch (err) {
      this.logger.error(`PATCH /teams/${id} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.TEAMS_DELETE)
  @Delete(":id")
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    this.logger.debug(`DELETE /teams/${id} called by ${user.sub}`);
    try {
      await this.teamsService.remove(id, user.sub);
      this.logger.debug(`DELETE /teams/${id} succeeded`);
      return { success: true };
    } catch (err) {
      this.logger.error(`DELETE /teams/${id} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  private toResponse(team: Team): TeamResponse {
    return {
      id: team.id,
      tenantId: team.tenantId,
      name: team.name,
    };
  }
}
