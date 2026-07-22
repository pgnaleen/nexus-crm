import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CreateDealDocumentDto } from "./dto/create-deal-document.dto";
import { DealDocument } from "./entities/deal-document.entity";
import { DealsService } from "./deals.service";

@Injectable()
export class DealDocumentsService {
  constructor(
    @InjectRepository(DealDocument) private readonly repo: Repository<DealDocument>,
    private readonly dealsService: DealsService,
  ) {}

  async findAll(dealId: string): Promise<DealDocument[]> {
    // Confirms the deal exists and belongs to the current tenant before
    // touching its documents -- DealDocument has no tenant_id of its own.
    await this.dealsService.findOneOrFail(dealId);
    return this.repo.find({ where: { dealId }, order: { createdAt: "DESC" } });
  }

  async create(
    dealId: string,
    dto: CreateDealDocumentDto,
    s3Key: string,
    userId: string,
  ): Promise<DealDocument> {
    await this.dealsService.findOneOrFail(dealId);
    const document = this.repo.create({
      dealId,
      docType: dto.docType,
      title: dto.title,
      s3Key,
      createdBy: userId,
    });
    return this.repo.save(document);
  }

  async remove(dealId: string, documentId: string, userId: string): Promise<void> {
    await this.dealsService.findOneOrFail(dealId);
    const document = await this.repo.findOne({ where: { id: documentId, dealId } });
    if (!document) {
      throw new NotFoundException("Deal document not found");
    }
    await this.repo.softRemove(document);
    await this.repo.update(document.id, { deletedBy: userId });
  }
}
