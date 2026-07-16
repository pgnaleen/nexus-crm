import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateMainStageDto } from "./dto/create-main-stage.dto";
import { UpdateMainStageDto } from "./dto/update-main-stage.dto";
import { MainStage } from "./entities/main-stage.entity";
import { MainStagesRepository } from "./main-stages.repository";

@Injectable()
export class MainStagesService {
  constructor(private readonly mainStagesRepo: MainStagesRepository) {}

  async findAll(): Promise<MainStage[]> {
    return this.mainStagesRepo.findScoped({ order: { position: "ASC", name: "ASC" } });
  }

  async findOneOrFail(id: string): Promise<MainStage> {
    const stage = await this.mainStagesRepo.findOneScoped({ where: { id } });
    if (!stage) {
      throw new NotFoundException("Main stage not found");
    }
    return stage;
  }

  async create(dto: CreateMainStageDto, userId: string): Promise<MainStage> {
    const stage = this.mainStagesRepo.createScoped({ ...dto, createdBy: userId });
    return this.mainStagesRepo.saveScoped(stage);
  }

  async update(id: string, dto: UpdateMainStageDto, userId: string): Promise<MainStage> {
    const stage = await this.findOneOrFail(id);
    Object.assign(stage, dto, { updatedBy: userId });
    await this.mainStagesRepo.saveScoped(stage);
    // Re-fetch rather than return the in-memory object -- Object.assign copies
    // omitted dto fields as explicit `undefined`, which would misreport
    // untouched columns as missing in the API response (see rbac.service.ts).
    return this.findOneOrFail(id);
  }

  async remove(id: string): Promise<void> {
    const stage = await this.findOneOrFail(id);
    await this.mainStagesRepo.softRemoveScoped(stage);
  }
}
