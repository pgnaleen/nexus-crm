import { PERMISSIONS, RbacResourceResponse, RbacRoleResponse } from "@orelia/common";
import { Body, Controller, Delete, Get, Logger, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { AssignRoleResourcesDto } from "./dto/assign-role-resources.dto";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { RbacRole } from "./entities/rbac-role.entity";
import { RequirePermission } from "./decorators/require-permission.decorator";
import { PermissionsGuard } from "./guards/permissions.guard";
import { RbacService } from "./rbac.service";

@Controller("rbac")
export class RbacController {
  private readonly logger = new Logger(RbacController.name);

  constructor(private readonly rbacService: RbacService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.RBAC_VIEW])
  @Get("roles")
  async findAllRoles(): Promise<RbacRoleResponse[]> {
    this.logger.debug("GET /rbac/roles called");
    try {
      const rows = await this.rbacService.findAllRoles();
      this.logger.debug(`GET /rbac/roles returning ${rows.length} row(s)`);
      return rows.map(({ role, resourceCount }) => this.toRoleResponse(role, resourceCount));
    } catch (err) {
      this.logger.error(`GET /rbac/roles failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.RBAC_VIEW])
  @Get("resources")
  async findAllResources(): Promise<RbacResourceResponse[]> {
    this.logger.debug("GET /rbac/resources called");
    try {
      const resources = await this.rbacService.findAllResources();
      this.logger.debug(`GET /rbac/resources returning ${resources.length} row(s)`);
      return resources.map((resource) => ({
        id: resource.id,
        name: resource.name,
        description: resource.description ?? null,
        riskLevel: resource.riskLevel,
        isPlatformOnly: resource.isPlatformOnly,
      }));
    } catch (err) {
      this.logger.error(`GET /rbac/resources failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.RBAC_VIEW, PERMISSIONS.RBAC_UPDATE])
  @Get("roles/:id/resources")
  async getRoleResourceIds(@Param("id", ParseUUIDPipe) id: string): Promise<string[]> {
    this.logger.debug(`GET /rbac/roles/${id}/resources called`);
    try {
      await this.rbacService.findRoleOrFail(id);
      const ids = await this.rbacService.getResourceIdsForRole(id);
      this.logger.debug(`GET /rbac/roles/${id}/resources returning ${ids.length} id(s)`);
      return ids;
    } catch (err) {
      this.logger.error(`GET /rbac/roles/${id}/resources failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.RBAC_CREATE)
  @Post("roles")
  async create(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RbacRoleResponse> {
    this.logger.debug(`POST /rbac/roles called by ${user.sub} (name="${dto.name}")`);
    try {
      const role = await this.rbacService.createRole(dto, user.sub);
      this.logger.debug(`POST /rbac/roles succeeded for role ${role.id}`);
      return this.toRoleResponse(role, 0);
    } catch (err) {
      this.logger.error(`POST /rbac/roles failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.RBAC_UPDATE)
  @Patch("roles/:id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RbacRoleResponse> {
    this.logger.debug(`PATCH /rbac/roles/${id} called by ${user.sub}`);
    try {
      const role = await this.rbacService.updateRole(id, dto, user.sub);
      const resourceIds = await this.rbacService.getResourceIdsForRole(id);
      this.logger.debug(`PATCH /rbac/roles/${id} succeeded`);
      return this.toRoleResponse(role, resourceIds.length);
    } catch (err) {
      this.logger.error(`PATCH /rbac/roles/${id} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.RBAC_UPDATE)
  @Put("roles/:id/resources")
  async assignResources(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleResourcesDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RbacRoleResponse> {
    this.logger.debug(`PUT /rbac/roles/${id}/resources called by ${user.sub} (${dto.resourceIds.length} resource(s))`);
    try {
      await this.rbacService.assignResourcesToRole(id, dto, user.sub);
      const role = await this.rbacService.findRoleOrFail(id);
      this.logger.debug(`PUT /rbac/roles/${id}/resources succeeded`);
      return this.toRoleResponse(role, dto.resourceIds.length);
    } catch (err) {
      this.logger.error(`PUT /rbac/roles/${id}/resources failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.RBAC_DELETE)
  @Delete("roles/:id")
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    this.logger.debug(`DELETE /rbac/roles/${id} called by ${user.sub}`);
    try {
      await this.rbacService.removeRole(id, user.sub);
      this.logger.debug(`DELETE /rbac/roles/${id} succeeded`);
      return { success: true };
    } catch (err) {
      this.logger.error(`DELETE /rbac/roles/${id} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  private toRoleResponse(role: RbacRole, resourceCount: number): RbacRoleResponse {
    return {
      id: role.id,
      tenantId: role.tenantId,
      name: role.name,
      description: role.description ?? null,
      resourceCount,
    };
  }
}
