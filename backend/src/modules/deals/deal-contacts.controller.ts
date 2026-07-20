import { DealContactResponse, PERMISSIONS } from "@orelia/common";
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { AddDealContactDto } from "./dto/add-deal-contact.dto";
import { DealContactsMap } from "./entities/deal-contacts-map.entity";
import { DealContactsService } from "./deal-contacts.service";

@Controller("deals/:dealId/contacts")
export class DealContactsController {
  constructor(private readonly dealContactsService: DealContactsService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_READ])
  @Get()
  async findAll(@Param("dealId", ParseUUIDPipe) dealId: string): Promise<DealContactResponse[]> {
    const maps = await this.dealContactsService.findAll(dealId);
    return maps.map((map) => this.toResponse(map));
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_UPDATE])
  @Post()
  async add(
    @Param("dealId", ParseUUIDPipe) dealId: string,
    @Body() dto: AddDealContactDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealContactResponse> {
    const map = await this.dealContactsService.add(dealId, dto.contactId, user.sub);
    return this.toResponse(map);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_UPDATE])
  @Delete(":contactId")
  async remove(
    @Param("dealId", ParseUUIDPipe) dealId: string,
    @Param("contactId", ParseUUIDPipe) contactId: string,
  ): Promise<{ success: true }> {
    await this.dealContactsService.remove(dealId, contactId);
    return { success: true };
  }

  private toResponse(map: DealContactsMap): DealContactResponse {
    return {
      contactId: map.contactId,
      fullName: map.contact?.fullName ?? "",
      title: map.contact?.title ?? null,
      email: map.contact?.email ?? null,
    };
  }
}
