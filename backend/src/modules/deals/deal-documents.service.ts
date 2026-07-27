import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { S3Service } from "../../core/storage/s3.service";
import { CreateDealDocumentDto } from "./dto/create-deal-document.dto";
import { DealDocument } from "./entities/deal-document.entity";
import { DealsService } from "./deals.service";

const AUDIT_ENTITY_TYPE = "deal_document";

@Injectable()
export class DealDocumentsService {
  private readonly logger = new Logger(DealDocumentsService.name);

  constructor(
    @InjectRepository(DealDocument) private readonly repo: Repository<DealDocument>,
    private readonly dealsService: DealsService,
    private readonly auditLogService: AuditLogService,
    private readonly s3: S3Service,
  ) {}

  async findAll(dealId: string): Promise<DealDocument[]> {
    this.logger.debug(`findAll called for deal ${dealId}`);
    // Confirms the deal exists and belongs to the current tenant before
    // touching its documents -- DealDocument has no tenant_id of its own.
    await this.dealsService.findOneOrFail(dealId);
    const documents = await this.repo.find({ where: { dealId }, order: { createdAt: "DESC" } });
    this.logger.debug(`findAll returning ${documents.length} document(s) for deal ${dealId}`);
    return documents;
  }

  async create(
    dealId: string,
    dto: CreateDealDocumentDto,
    s3Key: string,
    userId: string,
  ): Promise<DealDocument> {
    this.logger.debug(`create called for deal ${dealId} by ${userId} (docType=${dto.docType})`);
    await this.dealsService.findOneOrFail(dealId);
    try {
      const document = this.repo.create({
        dealId,
        docType: dto.docType,
        title: dto.title,
        s3Key,
        createdBy: userId,
      });
      const saved = await this.repo.save(document);
      this.logger.debug(`create succeeded, document ${saved.id}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: saved.id,
        action: "insert",
        actorId: userId,
        changes: { dealId, docType: saved.docType, title: saved.title },
      });
      return saved;
    } catch (err) {
      this.logger.error(`create failed for deal ${dealId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async remove(dealId: string, documentId: string, userId: string): Promise<void> {
    this.logger.debug(`remove called for document ${documentId} on deal ${dealId} by ${userId}`);
    await this.dealsService.findOneOrFail(dealId);
    const document = await this.repo.findOne({ where: { id: documentId, dealId } });
    if (!document) {
      this.logger.debug(`Blocked: document ${documentId} not found on deal ${dealId}`);
      throw new NotFoundException("Deal document not found");
    }
    try {
      await this.repo.softRemove(document);
      await this.repo.update(document.id, { deletedBy: userId });
      this.logger.debug(`remove succeeded for document ${documentId}`);
      // Best-effort -- a failed S3 delete must never fail the DB delete that
      // already succeeded above; it just orphans one object for later cleanup.
      await this.s3.deleteObjectBestEffort(document.s3Key);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: documentId,
        action: "delete",
        actorId: userId,
        changes: { dealId, docType: document.docType, title: document.title },
      });
    } catch (err) {
      this.logger.error(`remove failed for document ${documentId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
