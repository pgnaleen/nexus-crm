import { PERMISSIONS, UserResponse, UserSummaryResponse } from "@orelia/common";
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { REFRESH_COOKIE } from "../auth/auth.constants";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { hashToken } from "../auth/util/token-hash";
import { RbacService } from "../rbac/rbac.service";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { ChangeOwnPasswordDto } from "./dto/change-own-password.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { User } from "./entities/user.entity";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly rbacService: RbacService,
  ) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.USERS_MANAGE)
  @Get()
  async findAll(): Promise<UserSummaryResponse[]> {
    const users = await this.usersService.findAll();
    const roleIdsMap = await this.rbacService.getRoleIdsForUsers(users.map(u => u.id));
    return users.map((user) => this.toSummaryResponse(user, roleIdsMap[user.id] || []));
  }

  // Must be declared after the plain "/" GET route above — not strictly
  // required here since there's no literal-path sibling route to collide
  // with, but keeping the convention consistent with TenantsController.
  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_UPDATE])
  @Get(":id")
  async findOne(@Param("id", ParseUUIDPipe) id: string): Promise<UserResponse> {
    const user = await this.usersService.findOneOrFail(id);
    const roleIds = await this.rbacService.getRoleIdsForUser(id);
    return this.toResponse(user, roleIds);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.USERS_CREATE)
  @Post()
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserResponse> {
    const created = await this.usersService.create(dto, user.sub);
    const roleIds = await this.rbacService.getRoleIdsForUser(created.id);
    return this.toResponse(created, roleIds);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.USERS_UPDATE)
  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserResponse> {
    const updated = await this.usersService.update(id, dto, user.sub);
    const roleIds = await this.rbacService.getRoleIdsForUser(updated.id);
    return this.toResponse(updated, roleIds);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_UPDATE])
  @Get(":id/roles")
  async getRoleIds(@Param("id", ParseUUIDPipe) id: string): Promise<string[]> {
    await this.usersService.findOneOrFail(id);
    return this.rbacService.getRoleIdsForUser(id);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.USERS_UPDATE)
  @Post(":id/reset-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.usersService.resetPassword(id, dto.password, user.sub);
  }

  // No PermissionsGuard/RequirePermission here -- any authenticated user
  // (via the global JwtAuthGuard) may change their own password, regardless
  // of what RBAC permissions their role otherwise grants.
  @Post("me/change-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  async changeOwnPassword(
    @Body() dto: ChangeOwnPasswordDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE];
    const currentTokenHash = rawRefreshToken ? hashToken(rawRefreshToken) : undefined;
    await this.usersService.changeOwnPassword(user.sub, dto, currentTokenHash);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.USERS_DISABLE)
  @Patch(":id/disable")
  async disable(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserResponse> {
    const updated = await this.usersService.disable(id, user.sub);
    const roleIds = await this.rbacService.getRoleIdsForUser(updated.id);
    return this.toResponse(updated, roleIds);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.USERS_DISABLE)
  @Patch(":id/enable")
  async enable(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserResponse> {
    const updated = await this.usersService.enable(id, user.sub);
    const roleIds = await this.rbacService.getRoleIdsForUser(updated.id);
    return this.toResponse(updated, roleIds);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.USERS_DELETE)
  @Delete(":id")
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.usersService.remove(id, user.sub);
    return { success: true };
  }

  private toSummaryResponse(user: User, roleIds: string[]): UserSummaryResponse {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      status: user.status,
      loggingEmail: user.loggingEmail,
      lastLoggingAt: user.lastLoggingAt ? user.lastLoggingAt.toISOString() : null,
      roleIds,
    };
  }

  private toResponse(user: User, roleIds: string[]): UserResponse {
    return {
      ...this.toSummaryResponse(user, roleIds),
      tenantId: user.tenantId,
      loggingAttempts: user.loggingAttempts,
      lockedUntil: user.lockedUntil ? user.lockedUntil.toISOString() : null,
      mustChangePassword: user.mustChangePassword,
      extras: user.extras ?? null,
    };
  }
}
