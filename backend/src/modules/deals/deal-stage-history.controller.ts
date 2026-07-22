import { DealStageHistoryResponse, PERMISSIONS } from "@orelia/common";
import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { DealStageHistoryService } from "./deal-stage-history.service";
import { DealsService } from "./deals.service";

@Controller("deals/:dealId/stage-history")
export class DealStageHistoryController {
  constructor(
    private readonly dealsService: DealsService,
    private readonly stageHistoryService: DealStageHistoryService,
  ) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_VIEW])
  @Get()
  async findAll(@Param("dealId", ParseUUIDPipe) dealId: string): Promise<DealStageHistoryResponse[]> {
    // Tenant + existence check -- the history rows have no tenantId of their
    // own, so access is guarded via this deal lookup before querying them.
    await this.dealsService.findOneOrFail(dealId);
    return this.stageHistoryService.listForDeal(dealId);
  }
}
