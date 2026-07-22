import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateDealSourceDto } from "./dto/create-deal-source.dto";
import { UpdateDealSourceDto } from "./dto/update-deal-source.dto";
import { DealSource } from "./entities/deal-source.entity";
import { DealSourcesRepository } from "./deal-sources.repository";

@Injectable()
export class DealSourcesService {
  constructor(private readonly dealSourcesRepo: DealSourcesRepository) {}

  async findAll(): Promise<DealSource[]> {
    return this.dealSourcesRepo.findScoped({ order: { name: "ASC" } });
  }

  async findOneOrFail(id: string): Promise<DealSource> {
    const source = await this.dealSourcesRepo.findOneScoped({ where: { id } });
    if (!source) {
      throw new NotFoundException("Deal source not found");
    }
    return source;
  }

  async create(dto: CreateDealSourceDto, userId: string): Promise<DealSource> {
    const source = this.dealSourcesRepo.createScoped({ ...dto, createdBy: userId });
    return this.dealSourcesRepo.saveScoped(source);
  }

  async update(id: string, dto: UpdateDealSourceDto, userId: string): Promise<DealSource> {
    const source = await this.findOneOrFail(id);
    Object.assign(source, dto, { updatedBy: userId });
    await this.dealSourcesRepo.saveScoped(source);
    // Re-fetch rather than return the in-memory object -- Object.assign copies
    // omitted dto fields as explicit `undefined`, which would misreport
    // untouched columns as missing in the API response (see rbac.service.ts).
    return this.findOneOrFail(id);
  }

  async remove(id: string, userId: string): Promise<void> {
    const source = await this.findOneOrFail(id);
    await this.dealSourcesRepo.softRemoveScoped(source, userId);
  }
}
