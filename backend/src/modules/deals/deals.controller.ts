import { DealDependentsCountResponse, DealPartnerLinkResponse, DealResponse, PERMISSIONS } from "@orelia/common";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { DealPartnersService } from "./deal-partners.service";
import { CreateDealDto } from "./dto/create-deal.dto";
import { MoveDealDto } from "./dto/move-deal.dto";
import { UpdateDealDto } from "./dto/update-deal.dto";
import { Deal } from "./entities/deal.entity";
import { DealsService } from "./deals.service";

@Controller("deals")
export class DealsController {
  constructor(
    private readonly dealsService: DealsService,
    private readonly dealPartnersService: DealPartnersService,
  ) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_VIEW])
  @Get()
  async findAll(@Query("mainStageId") mainStageId?: string): Promise<DealResponse[]> {
    const deals = await this.dealsService.findAll(mainStageId);
    return deals.map((deal) => this.toResponse(deal));
  }

  // Declared before the ":id" route below so "partner-links" isn't swallowed
  // as a route param. Bulk id-only lookup for the Funnel board's Partner
  // filter -- see DealPartnerLinkResponse for why this isn't just embedded
  // in the list response above.
  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_VIEW])
  @Get("partner-links")
  async findPartnerLinks(): Promise<DealPartnerLinkResponse[]> {
    const links = await this.dealPartnersService.findAllLinksForTenant();
    return links.map((link) => ({
      dealId: link.dealId,
      companyId: link.companyId ?? null,
      contactId: link.contactId ?? null,
    }));
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_VIEW])
  @Get(":id")
  async findOne(@Param("id", ParseUUIDPipe) id: string): Promise<DealResponse> {
    const deal = await this.dealsService.findOneOrFail(id);
    return this.toResponse(deal);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_CREATE])
  @Post()
  async create(
    @Body() dto: CreateDealDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealResponse> {
    const deal = await this.dealsService.create(dto, user.sub);
    return this.toResponse(deal);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_UPDATE])
  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateDealDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealResponse> {
    const deal = await this.dealsService.update(id, dto, user.sub);
    return this.toResponse(deal);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_UPDATE])
  @Post(":id/move")
  async move(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: MoveDealDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealResponse> {
    const deal = await this.dealsService.moveStage(id, dto, user.sub);
    return this.toResponse(deal);
  }

  // Gated on DEALS_DELETE, not DEALS_VIEW -- the only consumer is the delete
  // confirmation dialog, which only ever renders for someone who already
  // holds delete permission.
  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_DELETE])
  @Get(":id/dependents-count")
  async dependentsCount(@Param("id", ParseUUIDPipe) id: string): Promise<DealDependentsCountResponse> {
    const count = await this.dealsService.countDependents(id);
    return { count };
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_DELETE])
  @Delete(":id")
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.dealsService.remove(id, user.sub);
    return { success: true };
  }

  private toResponse(deal: Deal): DealResponse {
    return {
      id: deal.id,
      tenantId: deal.tenantId,
      dealCode: deal.dealCode,
      name: deal.name,
      dealType: deal.dealType,
      companyId: deal.companyId ?? null,
      companyName: deal.company?.name,
      companyCountries: deal.company?.countries ?? null,
      primaryContactId: deal.primaryContactId ?? null,
      primaryContactName: deal.primaryContact?.fullName ?? null,
      contactId: deal.contactId ?? null,
      contactName: deal.contact?.fullName ?? null,
      sourceId: deal.sourceId ?? null,
      sourceName: deal.source?.name ?? null,
      ownerId: deal.ownerId,
      ownerName: deal.owner?.fullName,
      preSalesPersonId: deal.preSalesPersonId ?? null,
      preSalesPersonName: deal.preSalesPerson?.fullName ?? null,
      pmoId: deal.pmoId ?? null,
      pmoName: deal.pmo?.fullName ?? null,
      mainStageId: deal.mainStageId,
      mainStageName: deal.mainStage?.name,
      currentStageId: deal.currentStageId ?? null,
      currentStageName: deal.currentStage?.name,
      status: deal.status,
      currency: deal.currency,
      departmentId: deal.departmentId ?? null,
      departmentName: deal.department?.name ?? null,
      dealCountry: deal.dealCountry ?? null,
      customerPainPoint: deal.customerPainPoint ?? null,
      product: deal.product ?? null,
      services: deal.services ?? null,
      estimatedValue: deal.estimatedValue ?? null,
      internalCosts: deal.internalCosts ?? null,
      externalCosts: deal.externalCosts ?? null,
      expectedCloseDate: deal.expectedCloseDate ?? null,
      competitors: deal.competitors ?? null,
      isTender: deal.isTender,
    };
  }
}
