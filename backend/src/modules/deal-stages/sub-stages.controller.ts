import { DealStageResponse, PERMISSIONS } from "@orelia/common";
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { CreateSubStageDto } from "./dto/create-sub-stage.dto";
import { UpdateSubStageDto } from "./dto/update-sub-stage.dto";
import { SubStage } from "./entities/sub-stage.entity";
import { SubStagesService } from "./sub-stages.service";

@Controller("sub-stages")
export class SubStagesController {
  constructor(private readonly subStagesService: SubStagesService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission([
    PERMISSIONS.SUB_STAGE_MANAGE,
    PERMISSIONS.SUB_STAGE_VIEW,
    PERMISSIONS.SUB_STAGE_CREATE,
    PERMISSIONS.SUB_STAGE_UPDATE,
    PERMISSIONS.SUB_STAGE_DELETE,
  ])
  @Get()
  async findAll(): Promise<DealStageResponse[]> {
    const subStages = await this.subStagesService.findAll();
    return subStages.map((subStage) => this.toResponse(subStage));
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.SUB_STAGE_MANAGE, PERMISSIONS.SUB_STAGE_CREATE])
  @Post()
  async create(
    @Body() dto: CreateSubStageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealStageResponse> {
    const subStage = await this.subStagesService.create(dto, user.sub);
    return this.toResponse(subStage);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.SUB_STAGE_MANAGE, PERMISSIONS.SUB_STAGE_UPDATE])
  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubStageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealStageResponse> {
    const subStage = await this.subStagesService.update(id, dto, user.sub);
    return this.toResponse(subStage);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.SUB_STAGE_MANAGE, PERMISSIONS.SUB_STAGE_DELETE])
  @Delete(":id")
  async remove(@Param("id", ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.subStagesService.remove(id);
    return { success: true };
  }

  private toResponse(subStage: SubStage): DealStageResponse {
    return {
      id: subStage.id,
      tenantId: subStage.tenantId,
      name: subStage.name,
      sortOrder: subStage.sortOrder,
      isWon: subStage.isWon,
      isLost: subStage.isLost,
      mainStageId: subStage.mainStageId,
    };
  }
}
