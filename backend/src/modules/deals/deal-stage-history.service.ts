import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DealStageHistoryResponse } from "@orelia/common";
import { MainStageHistory } from "./entities/main-stage-history.entity";
import { SubStageHistory } from "./entities/sub-stage-history.entity";

interface RecordMoveInput {
  dealId: string;
  fromStageId?: string;
  // Undefined on a Sub Stage move that leaves the deal with no Sub Stage
  // (Main-Stage-only position) -- always a real id for a Main Stage move.
  toStageId?: string;
  movedById: string;
  note?: string;
}

// No AuditLogService calls in this file, deliberately -- these history rows
// are themselves the permanent audit trail for stage moves (same "must
// survive independently" philosophy as audit_logs itself, see deals.service
// comments). Recording a second audit_logs entry for the fact that a
// history row was written would just be a circular, redundant record of the
// same event.
@Injectable()
export class DealStageHistoryService {
  private readonly logger = new Logger(DealStageHistoryService.name);

  constructor(
    @InjectRepository(SubStageHistory) private readonly subStageHistoryRepo: Repository<SubStageHistory>,
    @InjectRepository(MainStageHistory) private readonly mainStageHistoryRepo: Repository<MainStageHistory>,
  ) {}

  async recordSubStageMove(input: RecordMoveInput): Promise<void> {
    this.logger.debug(`recordSubStageMove called for deal ${input.dealId} (toStageId=${input.toStageId})`);
    try {
      await this.subStageHistoryRepo.save(this.subStageHistoryRepo.create(input));
      this.logger.debug(`recordSubStageMove succeeded for deal ${input.dealId}`);
    } catch (err) {
      this.logger.error(`recordSubStageMove failed for deal ${input.dealId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async recordMainStageMove(input: RecordMoveInput): Promise<void> {
    this.logger.debug(`recordMainStageMove called for deal ${input.dealId} (toStageId=${input.toStageId})`);
    try {
      await this.mainStageHistoryRepo.save(this.mainStageHistoryRepo.create(input));
      this.logger.debug(`recordMainStageMove succeeded for deal ${input.dealId}`);
    } catch (err) {
      this.logger.error(`recordMainStageMove failed for deal ${input.dealId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Caller must have already validated the deal belongs to the current
  // tenant (e.g. via DealsService.findOneOrFail) -- these history rows have
  // no tenantId column of their own, so access is guarded via the deal FK.
  async listForDeal(dealId: string): Promise<DealStageHistoryResponse[]> {
    this.logger.debug(`listForDeal called for deal ${dealId}`);
    const [subStages, mainStages] = await Promise.all([
      this.subStageHistoryRepo.find({
        where: { dealId },
        relations: ["fromStage", "toStage", "movedByUser"],
        order: { movedAt: "DESC" },
      }),
      this.mainStageHistoryRepo.find({
        where: { dealId },
        relations: ["fromStage", "toStage", "movedByUser"],
        order: { movedAt: "DESC" },
      }),
    ]);

    const entries: DealStageHistoryResponse[] = [
      ...subStages.map((entry) => ({
        id: entry.id,
        kind: "sub_stage" as const,
        fromStageId: entry.fromStageId ?? null,
        fromStageName: entry.fromStage?.name ?? null,
        toStageId: entry.toStageId ?? null,
        toStageName: entry.toStage?.name ?? null,
        movedById: entry.movedById ?? null,
        movedByName: entry.movedByUser?.displayName ?? null,
        movedAt: entry.movedAt.toISOString(),
        note: entry.note ?? null,
      })),
      ...mainStages.map((entry) => ({
        id: entry.id,
        kind: "main_stage" as const,
        fromStageId: entry.fromStageId ?? null,
        fromStageName: entry.fromStage?.name ?? null,
        toStageId: entry.toStageId,
        toStageName: entry.toStage?.name ?? "",
        movedById: entry.movedById ?? null,
        movedByName: entry.movedByUser?.displayName ?? null,
        movedAt: entry.movedAt.toISOString(),
        note: entry.note ?? null,
      })),
    ];

    this.logger.debug(`listForDeal returning ${entries.length} history entr${entries.length === 1 ? "y" : "ies"} for deal ${dealId}`);
    return entries.sort((a, b) => (a.movedAt < b.movedAt ? 1 : -1));
  }
}
