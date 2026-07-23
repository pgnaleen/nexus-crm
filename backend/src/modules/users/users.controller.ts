import { PERMISSIONS, UserResponse, UserSummaryResponse } from "@orelia/common";
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { REFRESH_COOKIE } from "../auth/auth.constants";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { hashToken } from "../auth/util/token-hash";
import { EmployeesService } from "../employees/employees.service";
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
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly rbacService: RbacService,
    private readonly employeesService: EmployeesService,
  ) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.USERS_VIEW])
  @Get()
  async findAll(): Promise<UserSummaryResponse[]> {
    this.logger.debug("GET /users called");
    try {
      const users = await this.usersService.findAll();
      this.logger.debug(`GET /users returning ${users.length} row(s)`);
      return users.map((user) => this.toSummaryResponse(user));
    } catch (err) {
      this.logger.error(`GET /users failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Must be declared after the plain "/" GET route above — not strictly
  // required here since there's no literal-path sibling route to collide
  // with, but keeping the convention consistent with TenantsController.
  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_UPDATE])
  @Get(":id")
  async findOne(@Param("id", ParseUUIDPipe) id: string): Promise<UserResponse> {
    this.logger.debug(`GET /users/${id} called`);
    try {
      const user = await this.usersService.findOneOrFail(id);
      this.logger.debug(`GET /users/${id} succeeded`);
      return this.toResponse(user);
    } catch (err) {
      this.logger.error(`GET /users/${id} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.USERS_CREATE)
  @Post()
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserResponse> {
    // Never log dto directly -- it carries a plaintext password.
    this.logger.debug(`POST /users called by ${user.sub} (username="${dto.username}")`);
    try {
      const created = await this.usersService.create(dto, user.sub);
      this.logger.debug(`POST /users succeeded for user ${created.id}`);
      return this.toResponse(created);
    } catch (err) {
      this.logger.error(`POST /users failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.USERS_UPDATE)
  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserResponse> {
    this.logger.debug(`PATCH /users/${id} called by ${user.sub}`);
    try {
      const updated = await this.usersService.update(id, dto, user.sub);
      this.logger.debug(`PATCH /users/${id} succeeded`);
      return this.toResponse(updated);
    } catch (err) {
      this.logger.error(`PATCH /users/${id} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_UPDATE])
  @Get(":id/roles")
  async getRoleIds(@Param("id", ParseUUIDPipe) id: string): Promise<string[]> {
    this.logger.debug(`GET /users/${id}/roles called`);
    try {
      await this.usersService.findOneOrFail(id);
      const ids = await this.rbacService.getRoleIdsForUser(id);
      this.logger.debug(`GET /users/${id}/roles returning ${ids.length} id(s)`);
      return ids;
    } catch (err) {
      this.logger.error(`GET /users/${id}/roles failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
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
    // Never log dto.password.
    this.logger.debug(`POST /users/${id}/reset-password called by ${user.sub}`);
    try {
      await this.usersService.resetPassword(id, dto.password, user.sub);
      this.logger.debug(`POST /users/${id}/reset-password succeeded`);
    } catch (err) {
      this.logger.error(`POST /users/${id}/reset-password failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
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
    // Never log dto.currentPassword/newPassword.
    this.logger.debug(`POST /users/me/change-password called by ${user.sub}`);
    try {
      const rawRefreshToken = req.cookies?.[REFRESH_COOKIE];
      const currentTokenHash = rawRefreshToken ? hashToken(rawRefreshToken) : undefined;
      await this.usersService.changeOwnPassword(user.sub, dto, currentTokenHash);
      this.logger.debug(`POST /users/me/change-password succeeded for ${user.sub}`);
    } catch (err) {
      this.logger.error(`POST /users/me/change-password failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.USERS_DISABLE)
  @Patch(":id/disable")
  async disable(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserResponse> {
    this.logger.debug(`PATCH /users/${id}/disable called by ${user.sub}`);
    try {
      const updated = await this.usersService.disable(id, user.sub);
      this.logger.debug(`PATCH /users/${id}/disable succeeded`);
      return this.toResponse(updated);
    } catch (err) {
      this.logger.error(`PATCH /users/${id}/disable failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.USERS_DISABLE)
  @Patch(":id/enable")
  async enable(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserResponse> {
    this.logger.debug(`PATCH /users/${id}/enable called by ${user.sub}`);
    try {
      const updated = await this.usersService.enable(id, user.sub);
      this.logger.debug(`PATCH /users/${id}/enable succeeded`);
      return this.toResponse(updated);
    } catch (err) {
      this.logger.error(`PATCH /users/${id}/enable failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.USERS_DELETE)
  @Delete(":id")
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    this.logger.debug(`DELETE /users/${id} called by ${user.sub}`);
    try {
      await this.usersService.remove(id, user.sub);
      this.logger.debug(`DELETE /users/${id} succeeded`);
      return { success: true };
    } catch (err) {
      this.logger.error(`DELETE /users/${id} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  private toSummaryResponse(user: User): UserSummaryResponse {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      status: user.status,
      loggingEmail: user.loggingEmail,
      lastLoggingAt: user.lastLoggingAt ? user.lastLoggingAt.toISOString() : null,
    };
  }

  // Story 1.6 -- async because linkedEmployee is resolved from
  // employees.user_id (the link's single source of truth), not a User column.
  private async toResponse(user: User): Promise<UserResponse> {
    const linkedEmployee = await this.employeesService.findByUserId(user.id);
    return {
      ...this.toSummaryResponse(user),
      tenantId: user.tenantId,
      loggingAttempts: user.loggingAttempts,
      lockedUntil: user.lockedUntil ? user.lockedUntil.toISOString() : null,
      mustChangePassword: user.mustChangePassword,
      extras: user.extras ?? null,
      linkedEmployee: linkedEmployee ? { id: linkedEmployee.id, fullName: linkedEmployee.fullName } : null,
    };
  }
}
