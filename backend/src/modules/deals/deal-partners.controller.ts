import { DealPartnerResponse, PERMISSIONS } from "@orelia/common";
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { AddDealPartnerCompanyDto } from "./dto/add-deal-partner-company.dto";
import { AddDealPartnerContactDto } from "./dto/add-deal-partner-contact.dto";
import { DealPartnersMap } from "./entities/deal-partners-map.entity";
import { DealPartnersService } from "./deal-partners.service";

@Controller("deals/:dealId/partners")
export class DealPartnersController {
  constructor(private readonly dealPartnersService: DealPartnersService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_VIEW])
  @Get()
  async findAll(@Param("dealId", ParseUUIDPipe) dealId: string): Promise<DealPartnerResponse[]> {
    const maps = await this.dealPartnersService.findAll(dealId);
    return maps.map((map) => this.toResponse(map));
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_UPDATE])
  @Post("companies")
  async addCompany(
    @Param("dealId", ParseUUIDPipe) dealId: string,
    @Body() dto: AddDealPartnerCompanyDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealPartnerResponse> {
    const map = await this.dealPartnersService.addCompany(dealId, dto.companyId, user.sub);
    return this.toResponse(map);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_UPDATE])
  @Post("contacts")
  async addContact(
    @Param("dealId", ParseUUIDPipe) dealId: string,
    @Body() dto: AddDealPartnerContactDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealPartnerResponse> {
    const map = await this.dealPartnersService.addContact(dealId, dto.contactId, user.sub);
    return this.toResponse(map);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_UPDATE])
  @Delete(":partnerId")
  async remove(
    @Param("dealId", ParseUUIDPipe) dealId: string,
    @Param("partnerId", ParseUUIDPipe) partnerId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.dealPartnersService.remove(dealId, partnerId, user.sub);
    return { success: true };
  }

  private toResponse(map: DealPartnersMap): DealPartnerResponse {
    const kind: "company" | "contact" = map.companyId ? "company" : "contact";
    return {
      id: map.id,
      kind,
      companyId: map.companyId ?? null,
      contactId: map.contactId ?? null,
      name: kind === "company" ? (map.company?.name ?? "") : (map.contact?.fullName ?? ""),
      subtitle: kind === "contact" ? (map.contact?.title ?? null) : null,
    };
  }
}
