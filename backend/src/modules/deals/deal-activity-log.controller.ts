import { DealActivityLogEntryResponse, PERMISSIONS } from "@orelia/common";
import { Controller, Get, Logger, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { AUDIT_ENTITY_TYPE, DealsService } from "./deals.service";

@Controller("deals/:dealId/activity-log")
export class DealActivityLogController {
  private readonly logger = new Logger(DealActivityLogController.name);

  constructor(
    private readonly dealsService: DealsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_VIEW])
  @Get()
  async findAll(@Param("dealId", ParseUUIDPipe) dealId: string): Promise<DealActivityLogEntryResponse[]> {
    this.logger.debug(`GET /deals/${dealId}/activity-log called`);
    try {
      // Tenant + existence check -- audit_logs rows have no FK of their own,
      // so access is guarded via this deal lookup before querying them, same
      // pattern as DealStageHistoryController.
      await this.dealsService.findOneOrFail(dealId);
      const rows = await this.auditLogService.findForEntityWithActors(AUDIT_ENTITY_TYPE, dealId);
      const response: DealActivityLogEntryResponse[] = rows.map((row) => ({
        id: row.id,
        action: row.action,
        actorId: row.actorId ?? null,
        actorName: row.actorName,
        occurredAt: row.occurredAt.toISOString(),
        changes: row.changes ?? null,
      }));
      this.logger.debug(`GET /deals/${dealId}/activity-log returning ${response.length} entr${response.length === 1 ? "y" : "ies"}`);
      return response;
    } catch (err) {
      this.logger.error(`GET /deals/${dealId}/activity-log failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
