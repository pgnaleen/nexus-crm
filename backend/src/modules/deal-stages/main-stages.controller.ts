import { MainStageResponse, PERMISSIONS } from "@orelia/common";
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { CreateMainStageDto } from "./dto/create-main-stage.dto";
import { UpdateMainStageDto } from "./dto/update-main-stage.dto";
import { MainStage } from "./entities/main-stage.entity";
import { MainStagesService } from "./main-stages.service";

@Controller("main-stages")
export class MainStagesController {
  constructor(private readonly mainStagesService: MainStagesService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission([
    PERMISSIONS.MAIN_STAGE_VIEW,
    PERMISSIONS.MAIN_STAGE_CREATE,
    PERMISSIONS.MAIN_STAGE_UPDATE,
    PERMISSIONS.MAIN_STAGE_DELETE,
  ])
  @Get()
  async findAll(): Promise<MainStageResponse[]> {
    const withCounts = await this.mainStagesService.findAllWithDependentCounts();
    return withCounts.map(({ stage, dependentCount }) => this.toResponse(stage, dependentCount));
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.MAIN_STAGE_CREATE])
  @Post()
  async create(
    @Body() dto: CreateMainStageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MainStageResponse> {
    const stage = await this.mainStagesService.create(dto, user.sub);
    return this.toResponse(stage, 0);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.MAIN_STAGE_UPDATE])
  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateMainStageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MainStageResponse> {
    const stage = await this.mainStagesService.update(id, dto, user.sub);
    const dependentCount = await this.mainStagesService.countDependents(id);
    return this.toResponse(stage, dependentCount);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.MAIN_STAGE_DELETE])
  @Delete(":id")
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.mainStagesService.remove(id, user.sub);
    return { success: true };
  }

  private toResponse(stage: MainStage, dependentCount: number): MainStageResponse {
    return {
      id: stage.id,
      tenantId: stage.tenantId,
      name: stage.name,
      position: stage.position,
      isWon: stage.isWon,
      isLost: stage.isLost,
      weightPercent: stage.weightPercent ?? null,
      dependentCount,
      createdAt: stage.createdAt.toISOString(),
      updatedAt: stage.updatedAt.toISOString(),
    };
  }
}
