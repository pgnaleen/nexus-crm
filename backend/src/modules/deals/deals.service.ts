import { DealStatus } from "@orelia/common";
import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateDealDto } from "./dto/create-deal.dto";
import { UpdateDealDto } from "./dto/update-deal.dto";
import { Deal } from "./entities/deal.entity";
import { DealsRepository } from "./deals.repository";

@Injectable()
export class DealsService {
  constructor(private readonly dealsRepo: DealsRepository) {}

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
}
