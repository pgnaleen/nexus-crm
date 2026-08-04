import { Controller, ForbiddenException, Get, Logger, Query, UseGuards } from "@nestjs/common";
import {
  DealsMetricsResponse,
  PartnersMetricsResponse,
  PERMISSIONS,
  TasksMetricsResponse,
  TenantsMetricsResponse,
  UsersMetricsResponse,
} from "@orelia/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { RbacService } from "../rbac/rbac.service";
import { DashboardMetricsService } from "./dashboard-metrics.service";

const DEFAULT_MONTHS = 6;
const DEFAULT_CURRENCY = "USD";

@Controller("dashboard/metrics")
export class DashboardMetricsController {
  private readonly logger = new Logger(DashboardMetricsController.name);

  constructor(
    private readonly dashboardMetricsService: DashboardMetricsService,
    private readonly rbacService: RbacService,
  ) {}

  @Get("deals")
  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.DEALS_VIEW)
  async getDealsMetrics(
    @Query("months") months?: string,
    @Query("currency") currency?: string,
  ): Promise<DealsMetricsResponse> {
    const parsedMonths = parseMonths(months);
    const parsedCurrency = parseCurrency(currency);
    this.logger.debug(`GET /dashboard/metrics/deals called (months=${parsedMonths}, currency=${parsedCurrency})`);
    try {
      const result = await this.dashboardMetricsService.getDealsMetrics(parsedMonths, parsedCurrency);
      this.logger.debug("GET /dashboard/metrics/deals succeeded");
      return result;
    } catch (err) {
      this.logger.error(`GET /dashboard/metrics/deals failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // AND, not OR -- @RequirePermission's array is OR-only, so this route is
  // gated on DEALS_VIEW via the decorator and RELATIONSHIP_VIEW is checked
  // by hand here, matching widget-registry.tsx's Partners Insight widget
  // requiring BOTH sections (it blends deal data with relationship-type data).
  @Get("partners")
  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.DEALS_VIEW)
  async getPartnersMetrics(@CurrentUser() user: AuthenticatedUser): Promise<PartnersMetricsResponse> {
    this.logger.debug(`GET /dashboard/metrics/partners called by ${user.sub}`);
    try {
      const permissions = await this.rbacService.getPermissionsForUser(user.sub);
      if (!permissions.includes(PERMISSIONS.RELATIONSHIP_VIEW)) {
        this.logger.debug(`Blocked: ${user.sub} lacks ${PERMISSIONS.RELATIONSHIP_VIEW}`);
        throw new ForbiddenException(`Missing required permission: ${PERMISSIONS.RELATIONSHIP_VIEW}`);
      }
      const result = await this.dashboardMetricsService.getPartnersMetrics();
      this.logger.debug("GET /dashboard/metrics/partners succeeded");
      return result;
    } catch (err) {
      if (!(err instanceof ForbiddenException)) {
        this.logger.error(`GET /dashboard/metrics/partners failed: ${(err as Error).message}`, (err as Error).stack);
      }
      throw err;
    }
  }

  @Get("tenants")
  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.TENANTS_VIEW)
  async getTenantsMetrics(@Query("months") months?: string): Promise<TenantsMetricsResponse> {
    const parsedMonths = parseMonths(months);
    this.logger.debug(`GET /dashboard/metrics/tenants called (months=${parsedMonths})`);
    try {
      const result = await this.dashboardMetricsService.getTenantsMetrics(parsedMonths);
      this.logger.debug("GET /dashboard/metrics/tenants succeeded");
      return result;
    } catch (err) {
      this.logger.error(`GET /dashboard/metrics/tenants failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @Get("users")
  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.USERS_VIEW)
  async getUsersMetrics(): Promise<UsersMetricsResponse> {
    this.logger.debug("GET /dashboard/metrics/users called");
    try {
      const result = await this.dashboardMetricsService.getUsersMetrics();
      this.logger.debug("GET /dashboard/metrics/users succeeded");
      return result;
    } catch (err) {
      this.logger.error(`GET /dashboard/metrics/users failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // No @RequirePermission -- auth only, matches TaskCompletionDonutWidget's
  // requiredSectionPrefixes: [] in widget-registry.tsx.
  @Get("tasks")
  async getTasksMetrics(): Promise<TasksMetricsResponse> {
    this.logger.debug("GET /dashboard/metrics/tasks called");
    try {
      const result = await this.dashboardMetricsService.getTasksMetrics();
      this.logger.debug("GET /dashboard/metrics/tasks succeeded");
      return result;
    } catch (err) {
      this.logger.error(`GET /dashboard/metrics/tasks failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}

function parseMonths(raw?: string): number {
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 24 ? parsed : DEFAULT_MONTHS;
}

// A malformed/missing code falls back to the default rather than 400ing --
// same permissive-default posture as parseMonths above. FxRatesService.convert
// itself already treats an unrecognized code as "no rate available" (returns
// the original amount + a warning) rather than throwing, so this is just
// normalizing the common cases (missing, lowercase) before it gets there.
function parseCurrency(raw?: string): string {
  if (!raw || raw.length !== 3) return DEFAULT_CURRENCY;
  return raw.toUpperCase();
}
