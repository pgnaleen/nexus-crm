import { DealStatus } from "@orelia/common";
import { Injectable, NotFoundException } from "@nestjs/common";
import { SubStagesService } from "../deal-stages/sub-stages.service";
import { CreateDealDto } from "./dto/create-deal.dto";
import { MoveDealDto } from "./dto/move-deal.dto";
import { UpdateDealDto } from "./dto/update-deal.dto";
import { Deal } from "./entities/deal.entity";
import { DealStageHistoryService } from "./deal-stage-history.service";
import { DealsRepository } from "./deals.repository";

@Injectable()
export class DealsService {
  constructor(
    private readonly dealsRepo: DealsRepository,
    private readonly subStagesService: SubStagesService,
    private readonly stageHistoryService: DealStageHistoryService,
  ) {}

  findAll(mainStageId?: string): Promise<Deal[]> {
    return this.dealsRepo.findAllWithRelations(mainStageId);
  }

  async findOneOrFail(id: string): Promise<Deal> {
    const deal = await this.dealsRepo.findOneWithRelations(id);
    if (!deal) {
      throw new NotFoundException("Deal not found");
    }
    return deal;
  }

  async create(dto: CreateDealDto, userId: string): Promise<Deal> {
    const count = await this.dealsRepo.countAllScoped();
    const dealCode = `DEAL-${String(count + 1).padStart(5, "0")}`;

    const deal = this.dealsRepo.createScoped({
      ...dto,
      dealCode,
      status: DealStatus.Open,
      createdBy: userId,
    });
    await this.dealsRepo.saveScoped(deal);
    return this.findOneOrFail(deal.id);
  }

  async update(id: string, dto: UpdateDealDto, userId: string): Promise<Deal> {
    const deal = await this.findOneOrFail(id);
    Object.assign(deal, dto, { updatedBy: userId });
    await this.dealsRepo.saveScoped(deal);
    // Re-fetch rather than return the in-memory object -- Object.assign copies
    // omitted dto fields as explicit `undefined`, which would misreport
    // untouched columns as missing in the API response.
    return this.findOneOrFail(id);
  }

  async remove(id: string): Promise<void> {
    const deal = await this.findOneOrFail(id);
    await this.dealsRepo.softRemoveScoped(deal);
  }

  async moveStage(id: string, dto: MoveDealDto, userId: string): Promise<Deal> {
    const deal = await this.findOneOrFail(id);
    // Validates toStageId is a real Sub Stage belonging to the current
    // tenant, not just any UUID that happens to exist in sub_stages.
    const targetStage = await this.subStagesService.findOneOrFail(dto.toStageId);

    const fromStageId = deal.currentStageId;
    const fromMainStageId = deal.mainStageId;

    deal.currentStageId = targetStage.id;
    deal.mainStageId = targetStage.mainStageId;
    deal.updatedBy = userId;
    await this.dealsRepo.saveScoped(deal);

    await this.stageHistoryService.recordSubStageMove({
      dealId: deal.id,
      fromStageId,
      toStageId: targetStage.id,
      movedById: userId,
      note: dto.note,
    });

    // Only log a Main Stage transition when the move actually crossed into
    // a different Main Stage -- most moves are within the same funnel stage.
    if (fromMainStageId !== targetStage.mainStageId) {
      await this.stageHistoryService.recordMainStageMove({
        dealId: deal.id,
        fromStageId: fromMainStageId,
        toStageId: targetStage.mainStageId,
        movedById: userId,
        note: dto.note,
      });
    }

    return this.findOneOrFail(id);
  }
}
