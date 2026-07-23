import { DealTenderDetailsResponse, PERMISSIONS } from "@orelia/common";
import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { UpsertDealTenderDetailsDto } from "./dto/upsert-deal-tender-details.dto";
import { DealTenderDetails } from "./entities/deal-tender-details.entity";
import { DealTenderDetailsService } from "./deal-tender-details.service";

@Controller("deals/:dealId/tender-details")
export class DealTenderDetailsController {
  constructor(private readonly dealTenderDetailsService: DealTenderDetailsService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_VIEW])
  @Get()
  async findOne(@Param("dealId", ParseUUIDPipe) dealId: string): Promise<DealTenderDetailsResponse | null> {
    const row = await this.dealTenderDetailsService.findOne(dealId);
    return row ? this.toResponse(row) : null;
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_UPDATE])
  @Put()
  async upsert(
    @Param("dealId", ParseUUIDPipe) dealId: string,
    @Body() dto: UpsertDealTenderDetailsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealTenderDetailsResponse> {
    const row = await this.dealTenderDetailsService.upsert(dealId, dto, user.sub);
    return this.toResponse(row);
  }

  private toResponse(row: DealTenderDetails): DealTenderDetailsResponse {
    return {
      id: row.id,
      dealId: row.dealId,
      tenderReference: row.tenderReference,
      issuingBody: row.issuingBody,
      bidBondRequired: row.bidBondRequired,
      bidBondAmount: row.bidBondAmount ?? null,
      emdAmount: row.emdAmount ?? null,
      submissionMode: row.submissionMode ?? null,
      evaluationType: row.evaluationType ?? null,
    };
  }
}
