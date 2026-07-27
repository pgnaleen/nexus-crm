import { DocumentOwnerType, DocumentType } from "@orelia/common";
import { Column, Entity, Index } from "typeorm";
import { AuditedTenantEntity } from "../../../core/tenant";

// Single generic store for every file attachment in the app -- deal
// documents, certification evidence, employee photo/CV, company logo.
// ownerType + ownerId is a polymorphic reference (same pattern as
// AuditLog.entityType/entityId) rather than a per-type FK column, since one
// row can point at a Deal, an EmployeeCertification, an Employee, or a
// Company depending on ownerType. docType is only meaningful for
// DealDocument (Contract/Proposal/... sub-category); every other owner type
// leaves it null. See DocumentsService for the replace-vs-add-vs-remove
// policy per ownerType.
@Entity("documents")
@Index(["tenantId", "ownerType", "ownerId"])
export class Document extends AuditedTenantEntity {
  @Column({ type: "enum", enum: DocumentOwnerType })
  ownerType!: DocumentOwnerType;

  @Column({ type: "uuid" })
  ownerId!: string;

  @Column({ type: "enum", enum: DocumentType, nullable: true })
  docType?: DocumentType | null;

  @Column({ type: "varchar", nullable: true })
  title?: string | null;

  @Column()
  s3Key!: string;
}
