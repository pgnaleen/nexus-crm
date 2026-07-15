import {
  IndustryResponse,
  PERMISSIONS,
  PlanResponse,
  PublicTenantResponse,
  TenantResponse,
} from "@orelia/common";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";
import { Tenant } from "./entities/tenant.entity";
import { TenantsService } from "./tenants.service";

@Controller("tenants")
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Public()
  @Get("by-slug/:slug")
  async findBySlug(@Param("slug") slug: string): Promise<PublicTenantResponse> {
    const tenant = await this.tenantsService.findBySlugOrFail(slug);
    return { name: tenant.name, slug: tenant.slug };
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.TENANTS_MANAGE)
  @Get()
  async findAll(): Promise<TenantResponse[]> {
    const tenants = await this.tenantsService.findAll();
    return tenants.map((tenant) => this.toResponse(tenant));
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.TENANTS_MANAGE)
  @Get("plans")
  async findAllPlans(): Promise<PlanResponse[]> {
    const plans = await this.tenantsService.findAllPlans();
    return plans.map((plan) => ({ id: plan.id, name: plan.name, amount: Number(plan.amount) }));
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.TENANTS_MANAGE)
  @Get("industries")
  async findAllIndustries(): Promise<IndustryResponse[]> {
    const industries = await this.tenantsService.findAllIndustries();
    return industries.map((industry) => ({ id: industry.id, name: industry.name }));
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.TENANTS_CREATE)
  @Post()
  async create(@Body() dto: CreateTenantDto): Promise<TenantResponse> {
    const created = await this.tenantsService.create(dto);
    return this.toResponse(await this.tenantsService.findOneOrFail(created.id));
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.TENANTS_UPDATE)
  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
  ): Promise<TenantResponse> {
    await this.tenantsService.update(id, dto);
    return this.toResponse(await this.tenantsService.findOneOrFail(id));
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(PERMISSIONS.TENANTS_DELETE)
  @Delete(":id")
  async remove(@Param("id", ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.tenantsService.remove(id);
    return { success: true };
  }

  private toResponse(tenant: Tenant): TenantResponse {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      planId: tenant.planId,
      planName: tenant.plan?.name ?? "—",
      industryId: tenant.industryId ?? null,
      industryName: tenant.industry?.name ?? null,
      tagline: tenant.tagline ?? null,
      phoneNo: tenant.phoneNo ?? null,
      contactEmail: tenant.contactEmail ?? null,
      billingEmail: tenant.billingEmail ?? null,
      address: tenant.address ?? null,
    };
  }
}
