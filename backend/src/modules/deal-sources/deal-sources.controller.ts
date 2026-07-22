import { DealSourceResponse, PERMISSIONS } from "@orelia/common";
import { Body, Controller, Delete, Get, Logger, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
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
  private readonly logger = new Logger(DealSourcesController.name);

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
    this.logger.debug("GET /deal-sources called");
    try {
      const sources = await this.dealSourcesService.findAll();
      this.logger.debug(`GET /deal-sources returning ${sources.length} row(s)`);
      return sources.map((source) => this.toResponse(source));
    } catch (err) {
      this.logger.error(`GET /deal-sources failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEAL_SOURCE_CREATE])
  @Post()
  async create(
    @Body() dto: CreateDealSourceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealSourceResponse> {
    this.logger.debug(`POST /deal-sources called by ${user.sub} (name="${dto.name}")`);
    try {
      const source = await this.dealSourcesService.create(dto, user.sub);
      this.logger.debug(`POST /deal-sources succeeded for deal source ${source.id}`);
      return this.toResponse(source);
    } catch (err) {
      this.logger.error(`POST /deal-sources failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEAL_SOURCE_UPDATE])
  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateDealSourceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealSourceResponse> {
    this.logger.debug(`PATCH /deal-sources/${id} called by ${user.sub}`);
    try {
      const source = await this.dealSourcesService.update(id, dto, user.sub);
      this.logger.debug(`PATCH /deal-sources/${id} succeeded`);
      return this.toResponse(source);
    } catch (err) {
      this.logger.error(`PATCH /deal-sources/${id} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEAL_SOURCE_DELETE])
  @Delete(":id")
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    this.logger.debug(`DELETE /deal-sources/${id} called by ${user.sub}`);
    try {
      await this.dealSourcesService.remove(id, user.sub);
      this.logger.debug(`DELETE /deal-sources/${id} succeeded`);
      return { success: true };
    } catch (err) {
      this.logger.error(`DELETE /deal-sources/${id} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
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
