import { DealSourceResponse, PERMISSIONS } from "@orelia/common";
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { CreateDealSourceDto } from "./dto/create-deal-source.dto";
import { UpdateDealSourceDto } from "./dto/update-deal-source.dto";
import { DealSource } from "./entities/deal-source.entity";
import { DealSourcesService } from "./deal-sources.service";

@Controller("deal-sources")
export class DealSourcesController {
  constructor(private readonly dealSourcesService: DealSourcesService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission([
    PERMISSIONS.DEAL_SOURCE_VIEW,
    PERMISSIONS.DEAL_SOURCE_CREATE,
    PERMISSIONS.DEAL_SOURCE_UPDATE,
    PERMISSIONS.DEAL_SOURCE_DELETE,
  ])
  @Get()
  async findAll(): Promise<DealSourceResponse[]> {
    const sources = await this.dealSourcesService.findAll();
    return sources.map((source) => this.toResponse(source));
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEAL_SOURCE_CREATE])
  @Post()
  async create(
    @Body() dto: CreateDealSourceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealSourceResponse> {
    const source = await this.dealSourcesService.create(dto, user.sub);
    return this.toResponse(source);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEAL_SOURCE_UPDATE])
  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateDealSourceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealSourceResponse> {
    const source = await this.dealSourcesService.update(id, dto, user.sub);
    return this.toResponse(source);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEAL_SOURCE_DELETE])
  @Delete(":id")
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.dealSourcesService.remove(id, user.sub);
    return { success: true };
  }

  private toResponse(source: DealSource): DealSourceResponse {
    return {
      id: source.id,
      tenantId: source.tenantId,
      name: source.name,
      category: source.category ?? null,
      isActive: source.isActive,
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),
    };
  }
}
