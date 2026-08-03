import { DealRoleResponse, PERMISSIONS } from "@orelia/common";
import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { CreateDealRoleDto } from "./dto/create-deal-role.dto";
import { DealRole } from "./entities/deal-role.entity";
import { DealRolesService } from "./deal-roles.service";

@Controller("deal-roles")
export class DealRolesController {
  constructor(private readonly dealRolesService: DealRolesService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_VIEW])
  @Get()
  async findAll(): Promise<DealRoleResponse[]> {
    const roles = await this.dealRolesService.findAllForTenant();
    return roles.map((role) => this.toResponse(role));
  }

  // No dedicated DEAL_ROLE_* permission -- per the lightweight-inline scope
  // for this feature, adding a custom role is gated the same as any other
  // deal-team write (see deal-team.controller.ts).
  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_UPDATE])
  @Post()
  async create(@Body() dto: CreateDealRoleDto, @CurrentUser() user: AuthenticatedUser): Promise<DealRoleResponse> {
    const role = await this.dealRolesService.create(dto.name, user.sub);
    return this.toResponse(role);
  }

  private toResponse(role: DealRole): DealRoleResponse {
    return {
      id: role.id,
      tenantId: role.tenantId,
      name: role.name,
      requiresPrimaryOnCreate: role.requiresPrimaryOnCreate,
    };
  }
}
