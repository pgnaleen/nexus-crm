import { Injectable, Logger } from "@nestjs/common";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { UpsertDealTenderDetailsDto } from "./dto/upsert-deal-tender-details.dto";
import { DealTenderDetails } from "./entities/deal-tender-details.entity";
import { DealTenderDetailsRepository } from "./deal-tender-details.repository";
import { DealsService } from "./deals.service";

const AUDIT_ENTITY_TYPE = "deal_tender_details";

@Injectable()
export class DealTenderDetailsService {
  private readonly logger = new Logger(DealTenderDetailsService.name);

  constructor(
    private readonly repo: DealTenderDetailsRepository,
    private readonly dealsService: DealsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findOne(dealId: string): Promise<DealTenderDetails | null> {
    this.logger.debug(`findOne called for deal ${dealId}`);
    await this.dealsService.findOneOrFail(dealId);
    const row = await this.repo.findOneScoped({ where: { dealId } });
    this.logger.debug(row ? `Found existing tender details ${row.id}` : "No tender details saved yet for this deal");
    return row;
  }

  // Create-if-missing, else update -- one row per deal, so the caller never
  // has to know whether a row already exists.
  async upsert(dealId: string, dto: UpsertDealTenderDetailsDto, userId: string): Promise<DealTenderDetails> {
    this.logger.debug(`upsert called for deal ${dealId} by ${userId}`);
    await this.dealsService.findOneOrFail(dealId);

    const existing = await this.repo.findOneScoped({ where: { dealId } });

    try {
      if (existing) {
        this.logger.debug(`Updating existing tender details ${existing.id}`);
        const before: Record<string, unknown> = {};
        const existingAsRecord = existing as unknown as Record<string, unknown>;
        for (const key of Object.keys(dto)) {
          before[key] = existingAsRecord[key];
        }

        Object.assign(existing, dto, { updatedBy: userId });
        await this.repo.saveScoped(existing);

        const changes: Record<string, { old: unknown; new: unknown }> = {};
        const afterAsRecord = existing as unknown as Record<string, unknown>;
        for (const key of Object.keys(dto)) {
          const newValue = afterAsRecord[key];
          if (before[key] !== newValue) {
            changes[key] = { old: before[key], new: newValue };
          }
        }
        if (Object.keys(changes).length > 0) {
          await this.auditLogService.record({
            entityType: AUDIT_ENTITY_TYPE,
            entityId: existing.id,
            action: "update",
            actorId: userId,
            changes,
          });
        }
        this.logger.debug(`upsert (update) succeeded for ${existing.id}`);
        return existing;
      }

      this.logger.debug("No existing row -- creating a new one");
      const created = this.repo.createScoped({ ...dto, dealId, createdBy: userId });
      await this.repo.saveScoped(created);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: created.id,
        action: "insert",
        actorId: userId,
        changes: { dealId, ...dto },
      });
      this.logger.debug(`upsert (insert) succeeded for ${created.id}`);
      return created;
    } catch (err) {
      this.logger.error(`upsert failed for deal ${dealId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
