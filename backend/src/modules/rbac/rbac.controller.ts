import { PERMISSIONS, RbacResourceResponse, RbacRoleResponse } from "@orelia/common";
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from "@nestjs/common";
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
  constructor(private readonly rbacService: RbacService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.RBAC_MANAGE)
  @Get("roles")
  async findAllRoles(): Promise<RbacRoleResponse[]> {
    const rows = await this.rbacService.findAllRoles();
    return rows.map(({ role, resourceCount }) => this.toRoleResponse(role, resourceCount));
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.RBAC_MANAGE)
  @Get("resources")
  async findAllResources(): Promise<RbacResourceResponse[]> {
    const resources = await this.rbacService.findAllResources();
    return resources.map((resource) => ({
      id: resource.id,
      name: resource.name,
      description: resource.description ?? null,
      riskLevel: resource.riskLevel,
      isPlatformOnly: resource.isPlatformOnly,
    }));
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.RBAC_VIEW, PERMISSIONS.RBAC_UPDATE])
  @Get("roles/:id/resources")
  async getRoleResourceIds(@Param("id", ParseUUIDPipe) id: string): Promise<string[]> {
    await this.rbacService.findRoleOrFail(id);
    return this.rbacService.getResourceIdsForRole(id);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.RBAC_CREATE)
  @Post("roles")
  async create(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RbacRoleResponse> {
    const role = await this.rbacService.createRole(dto, user.sub);
    return this.toRoleResponse(role, 0);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.RBAC_UPDATE)
  @Patch("roles/:id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RbacRoleResponse> {
    const role = await this.rbacService.updateRole(id, dto, user.sub);
    const resourceIds = await this.rbacService.getResourceIdsForRole(id);
    return this.toRoleResponse(role, resourceIds.length);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.RBAC_UPDATE)
  @Put("roles/:id/resources")
  async assignResources(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleResourcesDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RbacRoleResponse> {
    await this.rbacService.assignResourcesToRole(id, dto, user.sub);
    const role = await this.rbacService.findRoleOrFail(id);
    return this.toRoleResponse(role, dto.resourceIds.length);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.RBAC_DELETE)
  @Delete("roles/:id")
  async remove(@Param("id", ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.rbacService.removeRole(id);
    return { success: true };
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
