import {
  IndustryResponse,
  PERMISSIONS,
  PlanResponse,
  PublicTenantResponse,
  TenantResponse,
  TenantSummaryResponse,
} from "@orelia/common";
import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";
import { Tenant } from "./entities/tenant.entity";
import { TenantsService } from "./tenants.service";

@Controller("tenants")
export class TenantsController {
  private readonly logger = new Logger(TenantsController.name);

  constructor(private readonly tenantsService: TenantsService) {}

  @Public()
  @Get("by-slug/:slug")
  async findBySlug(@Param("slug") slug: string): Promise<PublicTenantResponse> {
    this.logger.debug(`GET /tenants/by-slug/${slug} called`);
    try {
      const tenant = await this.tenantsService.findBySlugOrFail(slug);
      this.logger.debug(`GET /tenants/by-slug/${slug} succeeded`);
      return { name: tenant.name, slug: tenant.slug };
    } catch (err) {
      this.logger.error(`GET /tenants/by-slug/${slug} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.TENANTS_VIEW])
  @Get()
  async findAll(): Promise<TenantSummaryResponse[]> {
    this.logger.debug("GET /tenants called");
    try {
      const tenants = await this.tenantsService.findAll();
      this.logger.debug(`GET /tenants returning ${tenants.length} row(s)`);
      return tenants.map((tenant) => this.toSummaryResponse(tenant));
    } catch (err) {
      this.logger.error(`GET /tenants failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.TENANTS_VIEW])
  @Get("plans")
  async findAllPlans(): Promise<PlanResponse[]> {
    this.logger.debug("GET /tenants/plans called");
    try {
      const plans = await this.tenantsService.findAllPlans();
      this.logger.debug(`GET /tenants/plans returning ${plans.length} row(s)`);
      return plans.map((plan) => ({ id: plan.id, name: plan.name, amount: Number(plan.amount) }));
    } catch (err) {
      this.logger.error(`GET /tenants/plans failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.TENANTS_VIEW])
  @Get("industries")
  async findAllIndustries(): Promise<IndustryResponse[]> {
    this.logger.debug("GET /tenants/industries called");
    try {
      const industries = await this.tenantsService.findAllIndustries();
      this.logger.debug(`GET /tenants/industries returning ${industries.length} row(s)`);
      return industries.map((industry) => ({ id: industry.id, name: industry.name }));
    } catch (err) {
      this.logger.error(`GET /tenants/industries failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Must be declared after the "plans"/"industries" literal routes above —
  // Nest/Express matches routes in registration order, so a ":id" route
  // registered first would swallow those literal paths as an id value.
  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.TENANTS_VIEW, PERMISSIONS.TENANTS_UPDATE])
  @Get(":id")
  async findOne(@Param("id", ParseUUIDPipe) id: string): Promise<TenantResponse> {
    this.logger.debug(`GET /tenants/${id} called`);
    try {
      const tenant = await this.tenantsService.findOneOrFail(id);
      this.logger.debug(`GET /tenants/${id} succeeded`);
      return this.toResponse(tenant);
    } catch (err) {
      this.logger.error(`GET /tenants/${id} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.TENANTS_CREATE)
  @Post()
  async create(
    @Body() dto: CreateTenantDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TenantResponse> {
    this.logger.debug(`POST /tenants called by ${user.sub} (name="${dto.name}", slug="${dto.slug}")`);
    try {
      const created = await this.tenantsService.create(dto, user.sub);
      this.logger.debug(`POST /tenants succeeded for tenant ${created.id}`);
      return this.toResponse(await this.tenantsService.findOneOrFail(created.id));
    } catch (err) {
      this.logger.error(`POST /tenants failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.TENANTS_UPDATE)
  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TenantResponse> {
    this.logger.debug(`PATCH /tenants/${id} called by ${user.sub}`);
    try {
      await this.tenantsService.update(id, dto, user.sub);
      this.logger.debug(`PATCH /tenants/${id} succeeded`);
      return this.toResponse(await this.tenantsService.findOneOrFail(id));
    } catch (err) {
      this.logger.error(`PATCH /tenants/${id} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.TENANTS_DELETE)
  @Delete(":id")
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    this.logger.debug(`DELETE /tenants/${id} called by ${user.sub}`);
    try {
      await this.tenantsService.remove(id, user.sub);
      this.logger.debug(`DELETE /tenants/${id} succeeded`);
      return { success: true };
    } catch (err) {
      this.logger.error(`DELETE /tenants/${id} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  private toSummaryResponse(tenant: Tenant): TenantSummaryResponse {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      planId: tenant.planId,
      planName: tenant.plan?.name ?? "—",
      industryId: tenant.industryId ?? null,
      industryName: tenant.industry?.name ?? null,
    };
  }

  private toResponse(tenant: Tenant): TenantResponse {
    return {
      ...this.toSummaryResponse(tenant),
      tagline: tenant.tagline ?? null,
      phoneNo: tenant.phoneNo ?? null,
      contactEmail: tenant.contactEmail ?? null,
      billingEmail: tenant.billingEmail ?? null,
      address: tenant.address ?? null,
    };
  }
}
