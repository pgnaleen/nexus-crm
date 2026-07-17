import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateSubStageDto } from "./dto/create-sub-stage.dto";
import { UpdateSubStageDto } from "./dto/update-sub-stage.dto";
import { SubStage } from "./entities/sub-stage.entity";
import { MainStagesService } from "./main-stages.service";
import { SubStagesRepository } from "./sub-stages.repository";

@Injectable()
export class SubStagesService {
  constructor(
    private readonly subStagesRepo: SubStagesRepository,
    private readonly mainStagesService: MainStagesService,
  ) {}

  async findAll(): Promise<SubStage[]> {
    return this.subStagesRepo.findScoped({ order: { sortOrder: "ASC", name: "ASC" } });
  }

  async findOneOrFail(id: string): Promise<SubStage> {
    const subStage = await this.subStagesRepo.findOneScoped({ where: { id } });
    if (!subStage) {
      throw new NotFoundException("Sub stage not found");
    }
    return subStage;
  }

  async create(dto: CreateSubStageDto, userId: string): Promise<SubStage> {
    // Ensures mainStageId genuinely belongs to the current tenant, not just
    // any UUID that happens to exist in main_stages across all tenants.
    await this.mainStagesService.findOneOrFail(dto.mainStageId);
    const subStage = this.subStagesRepo.createScoped({ ...dto, createdBy: userId });
    return this.subStagesRepo.saveScoped(subStage);
  }

  async update(id: string, dto: UpdateSubStageDto, userId: string): Promise<SubStage> {
    const subStage = await this.findOneOrFail(id);
    if (dto.mainStageId) {
      await this.mainStagesService.findOneOrFail(dto.mainStageId);
    }
    Object.assign(subStage, dto, { updatedBy: userId });
    await this.subStagesRepo.saveScoped(subStage);
    // Re-fetch rather than return the in-memory object -- Object.assign copies
    // omitted dto fields as explicit `undefined`, which would misreport
    // untouched columns as missing in the API response.
    return this.findOneOrFail(id);
  }

  async remove(id: string): Promise<void> {
    const subStage = await this.findOneOrFail(id);
    await this.subStagesRepo.softRemoveScoped(subStage);
  }
}
