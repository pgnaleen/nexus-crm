import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DealStageHistoryResponse } from "@orelia/common";
import { MainStageHistory } from "./entities/main-stage-history.entity";
import { SubStageHistory } from "./entities/sub-stage-history.entity";

interface RecordMoveInput {
  dealId: string;
  fromStageId?: string;
  toStageId: string;
  movedById: string;
  note?: string;
}

@Injectable()
export class DealStageHistoryService {
  constructor(
    @InjectRepository(SubStageHistory) private readonly subStageHistoryRepo: Repository<SubStageHistory>,
    @InjectRepository(MainStageHistory) private readonly mainStageHistoryRepo: Repository<MainStageHistory>,
  ) {}

  async recordSubStageMove(input: RecordMoveInput): Promise<void> {
    await this.subStageHistoryRepo.save(this.subStageHistoryRepo.create(input));
  }

  async recordMainStageMove(input: RecordMoveInput): Promise<void> {
    await this.mainStageHistoryRepo.save(this.mainStageHistoryRepo.create(input));
  }

  // Caller must have already validated the deal belongs to the current
  // tenant (e.g. via DealsService.findOneOrFail) -- these history rows have
  // no tenantId column of their own, so access is guarded via the deal FK.
  async listForDeal(dealId: string): Promise<DealStageHistoryResponse[]> {
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
        toStageId: entry.toStageId,
        toStageName: entry.toStage?.name ?? "",
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

    return entries.sort((a, b) => (a.movedAt < b.movedAt ? 1 : -1));
  }
}
