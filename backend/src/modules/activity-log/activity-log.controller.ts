import { PERMISSIONS } from "@orelia/common";
import { Controller, Get, Logger, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { RbacService } from "../rbac/rbac.service";
import { ActivityLogService } from "./activity-log.service";
import { QueryActivityLogDto } from "./dto/query-activity-log.dto";

// Follows departments.controller.ts exactly: per-handler PermissionsGuard +
// RequirePermission, a Logger with debug-in/debug-out/error-with-rethrow.
// All three routes gated on the single AUDIT_LOG_VIEW key -- see
// permissions.ts's comment on why this resource has no create/update/delete.
@Controller("activity-log")
export class ActivityLogController {
  private readonly logger = new Logger(ActivityLogController.name);

  constructor(
    private readonly activityLogService: ActivityLogService,
    private readonly rbacService: RbacService,
  ) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.AUDIT_LOG_VIEW)
  @Get("audit")
  async findAuditLog(@Query() query: QueryActivityLogDto, @CurrentUser() user: AuthenticatedUser) {
    this.logger.debug(`GET /activity-log/audit called by ${user.sub} (page=${query.page ?? 1})`);
    try {
      const canViewSensitiveHr = await this.hasSensitiveAccess(user.sub);
      const result = await this.activityLogService.findAuditLog(query, canViewSensitiveHr);
      this.logger.debug(`GET /activity-log/audit returning ${result.items.length}/${result.total} row(s)`);
      return result;
    } catch (err) {
      this.logger.error(`GET /activity-log/audit failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.AUDIT_LOG_VIEW)
  @Get("auth")
  async findAuthEvents(@Query() query: QueryActivityLogDto, @CurrentUser() user: AuthenticatedUser) {
    this.logger.debug(`GET /activity-log/auth called by ${user.sub} (page=${query.page ?? 1})`);
    try {
      const result = await this.activityLogService.findAuthEvents(query);
      this.logger.debug(`GET /activity-log/auth returning ${result.items.length}/${result.total} row(s)`);
      return result;
    } catch (err) {
      this.logger.error(`GET /activity-log/auth failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.AUDIT_LOG_VIEW)
  @Get("filters")
  async findFilterOptions(@Query() query: QueryActivityLogDto, @CurrentUser() user: AuthenticatedUser) {
    this.logger.debug(`GET /activity-log/filters called by ${user.sub}`);
    try {
      const result = await this.activityLogService.findFilterOptions(query);
      this.logger.debug(
        `GET /activity-log/filters returning ${result.actors.length} actor(s), ${result.modules.length} module(s)`,
      );
      return result;
    } catch (err) {
      this.logger.error(`GET /activity-log/filters failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Same pattern as EmployeesController's own hasSensitiveAccess -- the
  // viewer's own permission, not the original actor's, gates whether
  // SENSITIVE_HR fields in `changes` are redacted for THIS read.
  private async hasSensitiveAccess(userId: string): Promise<boolean> {
    const permissions = await this.rbacService.getPermissionsForUser(userId);
    return permissions.includes(PERMISSIONS.EMPLOYEES_VIEW_SENSITIVE);
  }
}
