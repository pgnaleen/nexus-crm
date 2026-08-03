import { DealRoleAssignmentResponse, PERMISSIONS } from "@orelia/common";
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { AssignDealRoleDto } from "./dto/assign-deal-role.dto";
import { DealRoleAssignment } from "./entities/deal-role-assignment.entity";
import { DealRoleAssignmentsService } from "./deal-role-assignments.service";

@Controller("deals/:dealId/team")
export class DealTeamController {
  constructor(private readonly dealRoleAssignmentsService: DealRoleAssignmentsService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_VIEW])
  @Get()
  async findAll(@Param("dealId", ParseUUIDPipe) dealId: string): Promise<DealRoleAssignmentResponse[]> {
    const assignments = await this.dealRoleAssignmentsService.findAllForDeal(dealId);
    return assignments.map((assignment) => this.toResponse(assignment));
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_UPDATE])
  @Post()
  async assign(
    @Param("dealId", ParseUUIDPipe) dealId: string,
    @Body() dto: AssignDealRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealRoleAssignmentResponse> {
    const assignment = await this.dealRoleAssignmentsService.assign(dealId, dto.roleId, dto.userId, user.sub);
    return this.toResponse(assignment);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_UPDATE])
  @Delete(":assignmentId")
  async remove(
    @Param("dealId", ParseUUIDPipe) dealId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.dealRoleAssignmentsService.remove(dealId, assignmentId, user.sub);
    return { success: true };
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_UPDATE])
  @Patch(":assignmentId/primary")
  async setPrimary(
    @Param("dealId", ParseUUIDPipe) dealId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealRoleAssignmentResponse> {
    const assignment = await this.dealRoleAssignmentsService.setPrimary(dealId, assignmentId, user.sub);
    return this.toResponse(assignment);
  }

  private toResponse(assignment: DealRoleAssignment): DealRoleAssignmentResponse {
    return {
      id: assignment.id,
      dealId: assignment.dealId,
      roleId: assignment.roleId,
      roleName: assignment.role?.name ?? "",
      userId: assignment.userId,
      userDisplayName: assignment.user?.displayName ?? "",
      isPrimary: assignment.isPrimary,
    };
  }
}
