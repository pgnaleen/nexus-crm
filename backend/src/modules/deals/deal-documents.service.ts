import { DocumentOwnerType } from "@orelia/common";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { Document } from "../documents/entities/document.entity";
import { DocumentsService } from "../documents/documents.service";
import { CreateDealDocumentDto } from "./dto/create-deal-document.dto";
import { DealsService } from "./deals.service";

const AUDIT_ENTITY_TYPE = "deal_document";

// Deal documents are one of the five owner types stored in the shared
// `documents` table (see documents.service.ts) -- a pure multi-row list,
// nothing auto-retires, explicit delete is soft-delete only. This service
// keeps the deal-scoped route shape (/deals/:dealId/documents) and just
// delegates the actual storage to DocumentsService.
@Injectable()
export class DealDocumentsService {
  private readonly logger = new Logger(DealDocumentsService.name);

  constructor(
    private readonly documentsService: DocumentsService,
    private readonly dealsService: DealsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(dealId: string): Promise<Document[]> {
    this.logger.debug(`findAll called for deal ${dealId}`);
    // Confirms the deal exists and belongs to the current tenant before
    // touching its documents.
    await this.dealsService.findOneOrFail(dealId);
    const documents = await this.documentsService.findAllScoped(DocumentOwnerType.DealDocument, dealId);
    this.logger.debug(`findAll returning ${documents.length} document(s) for deal ${dealId}`);
    return documents;
  }

  // Naming inputs for the S3 key -- called by the controller before it
  // builds the key/uploads the file, so this deliberately uses the
  // lightweight findBasicOrFail (no relations) rather than the full
  // findOneOrFail create() below already pays for.
  async getDealNaming(dealId: string): Promise<{ dealCode: string; name: string }> {
    this.logger.debug(`getDealNaming called for deal ${dealId}`);
    const deal = await this.dealsService.findBasicOrFail(dealId);
    return { dealCode: deal.dealCode, name: deal.name };
  }

  async create(
    dealId: string,
    dto: CreateDealDocumentDto,
    s3Key: string,
    userId: string,
  ): Promise<Document> {
    this.logger.debug(`create called for deal ${dealId} by ${userId} (docType=${dto.docType})`);
    await this.dealsService.findOneOrFail(dealId);
    try {
      const saved = await this.documentsService.add(
        DocumentOwnerType.DealDocument,
        dealId,
        s3Key,
        userId,
        dto.title,
        dto.docType,
      );
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
    const documents = await this.documentsService.findAllScoped(DocumentOwnerType.DealDocument, dealId);
    const target = documents.find((d) => d.id === documentId);
    if (!target) {
      this.logger.debug(`Blocked: document ${documentId} not found on deal ${dealId}`);
      throw new NotFoundException("Deal document not found");
    }
    try {
      await this.documentsService.removeScoped(documentId, DocumentOwnerType.DealDocument, dealId, userId);
      this.logger.debug(`remove succeeded for document ${documentId}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: documentId,
        action: "delete",
        actorId: userId,
        changes: { dealId, docType: target.docType, title: target.title },
      });
    } catch (err) {
      this.logger.error(`remove failed for document ${documentId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
