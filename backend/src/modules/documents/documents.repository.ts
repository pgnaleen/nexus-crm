import { DocumentOwnerType } from "@orelia/common";
import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseTenantRepository, TenantContextService } from "../../core/tenant";
import { Document } from "./entities/document.entity";

@Injectable()
export class DocumentsRepository extends BaseTenantRepository<Document> {
  constructor(
    @InjectRepository(Document) repo: Repository<Document>,
    tenantContext: TenantContextService,
  ) {
    super(repo, tenantContext);
  }

  // Most recent still-active row for a single-slot owner (logo/photo/CV/
  // certification evidence) -- null if none uploaded, or the current one was
  // cleared/replaced and nothing new was set.
  findCurrentScoped(ownerType: DocumentOwnerType, ownerId: string): Promise<Document | null> {
    return this.findOneScoped({ where: { ownerType, ownerId }, order: { createdAt: "DESC" } });
  }

  // Every still-active row for a multi-document owner (deal documents).
  findAllScoped(ownerType: DocumentOwnerType, ownerId: string): Promise<Document[]> {
    return this.findScoped({ where: { ownerType, ownerId }, order: { createdAt: "DESC" } });
  }

  // Same two-step softRemove()+update() pattern as employees.repository.ts --
  // softRemove() alone has nowhere to carry the actor for deletedBy.
  async softRemoveScoped(document: Document, actorId?: string): Promise<void> {
    if (document.tenantId !== this.tenantContext.getTenantId()) {
      throw new ForbiddenException("Entity does not belong to the current tenant");
    }
    await this.repo.softRemove(document);
    await this.repo.update(document.id, { deletedBy: actorId });
  }

  // Genuinely gone, never coming back -- only for the "photo-like" owner
  // types (logo/employee photo) being replaced, where the old S3 object is
  // also being deleted in the same call. Never used for deal documents/
  // certification evidence/CV, which are soft-delete-only.
  async hardRemoveScoped(document: Document): Promise<void> {
    if (document.tenantId !== this.tenantContext.getTenantId()) {
      throw new ForbiddenException("Entity does not belong to the current tenant");
    }
    await this.repo.remove(document);
  }
}
