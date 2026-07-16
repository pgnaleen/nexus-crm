import { PERMISSIONS, TeamResponse } from "@orelia/common";
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
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
  constructor(private readonly teamsService: TeamsService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.TEAMS_VIEW)
  @Get()
  async findAll(): Promise<TeamResponse[]> {
    const teams = await this.teamsService.findAll();
    return teams.map((team) => this.toResponse(team));
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.TEAMS_CREATE)
  @Post()
  async create(
    @Body() dto: CreateTeamDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeamResponse> {
    const team = await this.teamsService.create(dto, user.sub);
    return this.toResponse(team);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.TEAMS_UPDATE)
  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeamResponse> {
    const team = await this.teamsService.update(id, dto, user.sub);
    return this.toResponse(team);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.TEAMS_DELETE)
  @Delete(":id")
  async remove(@Param("id", ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.teamsService.remove(id);
    return { success: true };
  }

  private toResponse(team: Team): TeamResponse {
    return {
      id: team.id,
      tenantId: team.tenantId,
      name: team.name,
    };
  }
}
