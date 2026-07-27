import { DocumentOwnerType, DocumentType } from "@orelia/common";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { S3Service } from "../../core/storage/s3.service";
import { DocumentsRepository } from "./documents.repository";
import { Document } from "./entities/document.entity";

// Single-slot owner types (one "current" value at a time) vs. their retire
// policy when replaced or explicitly cleared -- true hard-deletes the old
// row and its S3 object (plain "replace this picture" semantics), false
// soft-deletes the row only, S3 object kept, per the client's explicit call:
// pictures (logo/employee photo) replace with no history; CV and
// certification evidence keep every past version recoverable.
const HARD_RETIRE_ON_REPLACE: Partial<Record<DocumentOwnerType, boolean>> = {
  [DocumentOwnerType.CompanyLogo]: true,
  [DocumentOwnerType.EmployeePhoto]: true,
  [DocumentOwnerType.EmployeeCv]: false,
  [DocumentOwnerType.CertificationEvidence]: false,
};

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly documentsRepo: DocumentsRepository,
    private readonly s3: S3Service,
  ) {}

  findCurrentScoped(ownerType: DocumentOwnerType, ownerId: string): Promise<Document | null> {
    return this.documentsRepo.findCurrentScoped(ownerType, ownerId);
  }

  findAllScoped(ownerType: DocumentOwnerType, ownerId: string): Promise<Document[]> {
    return this.documentsRepo.findAllScoped(ownerType, ownerId);
  }

  async getDisplayUrl(ownerType: DocumentOwnerType, ownerId: string): Promise<string | null> {
    const current = await this.findCurrentScoped(ownerType, ownerId);
    return current ? this.s3.getSignedGetUrl(current.s3Key) : null;
  }

  // Single-slot upload: logo, employee photo, employee CV, certification
  // evidence. Retires whatever was previously current for this owner (per
  // HARD_RETIRE_ON_REPLACE) and creates the new row. Never used for deal
  // documents -- see add() below.
  async replaceSingle(
    ownerType: DocumentOwnerType,
    ownerId: string,
    s3Key: string,
    actorId: string,
    title?: string | null,
  ): Promise<Document> {
    this.logger.debug(`replaceSingle called (ownerType=${ownerType}, ownerId=${ownerId})`);
    await this.retireCurrent(ownerType, ownerId);
    const created = this.documentsRepo.createScoped({
      ownerType,
      ownerId,
      s3Key,
      title: title ?? null,
      createdBy: actorId,
    });
    const saved = await this.documentsRepo.saveScoped(created);
    this.logger.debug(`replaceSingle succeeded (document ${saved.id})`);
    return saved;
  }

  // Explicit clear-with-no-replacement (dto field set to null) -- retires
  // the current row per the same policy as replaceSingle, but creates
  // nothing new.
  async clearSingle(ownerType: DocumentOwnerType, ownerId: string): Promise<void> {
    this.logger.debug(`clearSingle called (ownerType=${ownerType}, ownerId=${ownerId})`);
    await this.retireCurrent(ownerType, ownerId);
  }

  private async retireCurrent(ownerType: DocumentOwnerType, ownerId: string): Promise<void> {
    const current = await this.documentsRepo.findCurrentScoped(ownerType, ownerId);
    if (!current) return;
    if (HARD_RETIRE_ON_REPLACE[ownerType]) {
      await this.documentsRepo.hardRemoveScoped(current);
      await this.s3.deleteObjectBestEffort(current.s3Key);
      this.logger.debug(`retireCurrent: hard-removed document ${current.id} and its S3 object`);
    } else {
      await this.documentsRepo.softRemoveScoped(current);
      this.logger.debug(`retireCurrent: soft-removed document ${current.id}, S3 object kept`);
    }
  }

  // Pure additive upload for multi-document owners (deal documents) --
  // nothing else gets retired, every upload is its own independent row.
  async add(
    ownerType: DocumentOwnerType,
    ownerId: string,
    s3Key: string,
    actorId: string,
    title?: string | null,
    docType?: DocumentType | null,
  ): Promise<Document> {
    this.logger.debug(`add called (ownerType=${ownerType}, ownerId=${ownerId})`);
    const created = this.documentsRepo.createScoped({
      ownerType,
      ownerId,
      s3Key,
      title: title ?? null,
      docType: docType ?? null,
      createdBy: actorId,
    });
    const saved = await this.documentsRepo.saveScoped(created);
    this.logger.debug(`add succeeded (document ${saved.id})`);
    return saved;
  }

  // Explicit delete for a multi-document owner's specific row (deal
  // documents). Soft-delete only -- the S3 object is deliberately never
  // touched, so a "deleted" document stays recoverable and the file itself
  // is never lost. ownerType/ownerId are passed in so a caller can't delete
  // a row belonging to a different owner via a route scoped to one (e.g.
  // /deals/:dealId/documents/:documentId).
  async removeScoped(
    id: string,
    ownerType: DocumentOwnerType,
    ownerId: string,
    actorId: string,
  ): Promise<void> {
    this.logger.debug(`removeScoped called (document ${id}, ownerType=${ownerType}, ownerId=${ownerId})`);
    const document = await this.documentsRepo.findOneScoped({ where: { id, ownerType, ownerId } });
    if (!document) {
      throw new NotFoundException("Document not found");
    }
    await this.documentsRepo.softRemoveScoped(document, actorId);
    this.logger.debug(`removeScoped succeeded for document ${id}`);
  }
}
