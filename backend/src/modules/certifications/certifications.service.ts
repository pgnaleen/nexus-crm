import { DocumentOwnerType, EmployeeCertificationStatus, EmploymentStatus } from "@orelia/common";
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ILike } from "typeorm";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { assertKeyBelongsToTenant, CERTIFICATION_SEGMENT } from "../../core/storage/storage.constants";
import { TenantContextService } from "../../core/tenant";
import { DocumentsService } from "../documents/documents.service";
import { EmployeesService } from "../employees/employees.service";
import { CertificationsRepository } from "./certifications.repository";
import { CreateCertificationDto } from "./dto/create-certification.dto";
import { UpdateCertificationDto } from "./dto/update-certification.dto";
import { EmployeeCertification } from "./entities/employee-certification.entity";

const AUDIT_ENTITY_TYPE = "employee_certification";

@Injectable()
export class CertificationsService {
  private readonly logger = new Logger(CertificationsService.name);

  constructor(
    private readonly certificationsRepo: CertificationsRepository,
    private readonly employeesService: EmployeesService,
    private readonly auditLogService: AuditLogService,
    private readonly documentsService: DocumentsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  // Every self-service route resolves the caller's own employee from their
  // user id first. No linked employee = they have no HR record to attach
  // certifications to (Story 1.6 governs the link).
  private async resolveEmployeeId(userId: string): Promise<string> {
    const employee = await this.employeesService.findByUserId(userId);
    if (!employee) {
      this.logger.debug(`resolveEmployeeId: user ${userId} has no linked employee`);
      throw new ForbiddenException("Your account is not linked to an employee record");
    }
    return employee.id;
  }

  // Loads a certification and asserts it belongs to the caller's employee.
  // A cert from another employee (or a stale id) is a 404, never leaked as a
  // 403 that would confirm the id exists.
  private async findOwnedOrFail(id: string, employeeId: string): Promise<EmployeeCertification> {
    const certification = await this.certificationsRepo.findOneScoped({ where: { id } });
    if (!certification || certification.employeeId !== employeeId) {
      this.logger.debug(`findOwnedOrFail: certification ${id} not found for employee ${employeeId}`);
      throw new NotFoundException("Certification not found");
    }
    return certification;
  }

  async listMine(userId: string): Promise<EmployeeCertification[]> {
    this.logger.debug(`listMine called by ${userId}`);
    try {
      const employeeId = await this.resolveEmployeeId(userId);
      const results = await this.certificationsRepo.findScoped({
        where: { employeeId },
        order: { createdAt: "DESC" },
      });
      this.logger.debug(`listMine returning ${results.length} row(s) for employee ${employeeId}`);
      return results;
    } catch (err) {
      if (!(err instanceof ForbiddenException)) {
        this.logger.error(`listMine failed: ${(err as Error).message}`, (err as Error).stack);
      }
      throw err;
    }
  }

  async createMine(userId: string, dto: CreateCertificationDto): Promise<EmployeeCertification> {
    this.logger.debug(`createMine called by ${userId} (name="${dto.name}")`);
    try {
      const { evidenceFileUrl, ...certData } = dto;
      if (evidenceFileUrl) {
        assertKeyBelongsToTenant(evidenceFileUrl, CERTIFICATION_SEGMENT, this.tenantContext.getTenantSlug());
      }
      const employeeId = await this.resolveEmployeeId(userId);
      // Status is always Pending on creation -- never trust a client to set
      // it; there's no status field on the DTO at all.
      const certification = this.certificationsRepo.createScoped({
        ...certData,
        employeeId,
        status: EmployeeCertificationStatus.Pending,
        createdBy: userId,
      });
      const saved = await this.certificationsRepo.saveScoped(certification);
      if (evidenceFileUrl) {
        await this.documentsService.replaceSingle(
          DocumentOwnerType.CertificationEvidence,
          saved.id,
          evidenceFileUrl,
          userId,
        );
      }
      this.logger.debug(`createMine succeeded (certification ${saved.id})`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: saved.id,
        action: "insert",
        actorId: userId,
        changes: { name: dto.name, issuingOrganization: dto.issuingOrganization, status: saved.status },
      });
      return saved;
    } catch (err) {
      if (!(err instanceof ForbiddenException)) {
        this.logger.error(`createMine failed: ${(err as Error).message}`, (err as Error).stack);
      }
      throw err;
    }
  }

  async updateMine(userId: string, id: string, dto: UpdateCertificationDto): Promise<EmployeeCertification> {
    this.logger.debug(`updateMine called by ${userId} for certification ${id}`);
    try {
      const { evidenceFileUrl, ...certDto } = dto;
      if (evidenceFileUrl) {
        assertKeyBelongsToTenant(evidenceFileUrl, CERTIFICATION_SEGMENT, this.tenantContext.getTenantSlug());
      }
      const employeeId = await this.resolveEmployeeId(userId);
      const certification = await this.findOwnedOrFail(id, employeeId);
      // Only a still-Pending claim is editable -- a Verified badge must not
      // be quietly edited into something false after the fact, and a
      // Rejected claim should be re-submitted fresh, not rewritten.
      if (certification.status !== EmployeeCertificationStatus.Pending) {
        this.logger.debug(`updateMine: certification ${id} is ${certification.status}, not editable`);
        throw new ForbiddenException("Only a pending certification can be edited");
      }

      const before: Record<string, unknown> = {};
      const asRecord = certification as unknown as Record<string, unknown>;
      for (const key of Object.keys(certDto)) {
        before[key] = asRecord[key];
      }
      const oldEvidenceDoc = "evidenceFileUrl" in dto
        ? await this.documentsService.findCurrentScoped(DocumentOwnerType.CertificationEvidence, id)
        : null;

      Object.assign(certification, certDto, { updatedBy: userId });
      const saved = await this.certificationsRepo.saveScoped(certification);
      this.logger.debug(`updateMine succeeded for certification ${id}`);

      // Evidence file replaced/cleared -- soft-delete only (old evidence
      // stays recoverable in S3), never a hard delete, per the client's
      // explicit "certifications need soft delete" call.
      if ("evidenceFileUrl" in dto) {
        if (evidenceFileUrl) {
          await this.documentsService.replaceSingle(
            DocumentOwnerType.CertificationEvidence,
            id,
            evidenceFileUrl,
            userId,
          );
        } else {
          await this.documentsService.clearSingle(DocumentOwnerType.CertificationEvidence, id);
        }
      }

      const changes: Record<string, { old: unknown; new: unknown }> = {};
      const savedAsRecord = saved as unknown as Record<string, unknown>;
      for (const key of Object.keys(certDto)) {
        if (before[key] !== savedAsRecord[key]) {
          changes[key] = { old: before[key] ?? null, new: savedAsRecord[key] ?? null };
        }
      }
      if ("evidenceFileUrl" in dto && (oldEvidenceDoc?.s3Key ?? null) !== (evidenceFileUrl ?? null)) {
        changes.evidenceFileUrl = { old: oldEvidenceDoc?.s3Key ?? null, new: evidenceFileUrl ?? null };
      }
      if (Object.keys(changes).length > 0) {
        await this.auditLogService.record({
          entityType: AUDIT_ENTITY_TYPE,
          entityId: id,
          action: "update",
          actorId: userId,
          changes,
        });
      }
      return saved;
    } catch (err) {
      if (!(err instanceof ForbiddenException) && !(err instanceof NotFoundException)) {
        this.logger.error(`updateMine failed for certification ${id}: ${(err as Error).message}`, (err as Error).stack);
      }
      throw err;
    }
  }

  // ── Story 1.13: HR review (EMPLOYEES_VERIFY_CERTIFICATIONS) ────────────
  // Not self-service -- these operate on any employee's claim in the tenant,
  // gated at the controller by the verify permission.

  // Every Pending claim in the tenant, with the submitting employee loaded
  // so the reviewer knows whose claim it is.
  async findPendingForReview(): Promise<EmployeeCertification[]> {
    this.logger.debug("findPendingForReview called");
    try {
      const results = await this.certificationsRepo.findScoped({
        where: { status: EmployeeCertificationStatus.Pending },
        relations: ["employee"],
        order: { createdAt: "ASC" },
      });
      this.logger.debug(`findPendingForReview returning ${results.length} pending claim(s)`);
      return results;
    } catch (err) {
      this.logger.error(`findPendingForReview failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  private async findPendingOrFail(id: string): Promise<EmployeeCertification> {
    const certification = await this.certificationsRepo.findOneScoped({ where: { id } });
    if (!certification) {
      throw new NotFoundException("Certification not found");
    }
    // Only a Pending claim is reviewable -- re-verifying/re-rejecting an
    // already-decided one would silently overwrite the prior decision.
    if (certification.status !== EmployeeCertificationStatus.Pending) {
      this.logger.debug(`findPendingOrFail: certification ${id} is ${certification.status}, not pending`);
      throw new BadRequestException("This certification has already been reviewed");
    }
    return certification;
  }

  async verify(id: string, reviewerId: string): Promise<EmployeeCertification> {
    this.logger.debug(`verify called for certification ${id} by ${reviewerId}`);
    try {
      const certification = await this.findPendingOrFail(id);
      // AC: a claim with no evidence (neither file nor link) cannot be
      // verified -- an unsupported claim can only be rejected.
      const evidenceDoc = await this.documentsService.findCurrentScoped(
        DocumentOwnerType.CertificationEvidence,
        id,
      );
      if (!evidenceDoc && !certification.evidenceLink) {
        this.logger.debug(`verify: certification ${id} has no evidence, refusing to verify`);
        throw new BadRequestException("A certification with no evidence cannot be verified");
      }
      certification.status = EmployeeCertificationStatus.Verified;
      certification.verifiedById = reviewerId;
      certification.verifiedAt = new Date();
      (certification as { rejectionReason: string | null }).rejectionReason = null;
      certification.updatedBy = reviewerId;
      const saved = await this.certificationsRepo.saveScoped(certification);
      this.logger.debug(`verify succeeded for certification ${id}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: id,
        action: "update",
        actorId: reviewerId,
        changes: { status: { old: EmployeeCertificationStatus.Pending, new: EmployeeCertificationStatus.Verified } },
      });
      return saved;
    } catch (err) {
      if (!(err instanceof BadRequestException) && !(err instanceof NotFoundException)) {
        this.logger.error(`verify failed for certification ${id}: ${(err as Error).message}`, (err as Error).stack);
      }
      throw err;
    }
  }

  async reject(id: string, reviewerId: string, rejectionReason: string): Promise<EmployeeCertification> {
    this.logger.debug(`reject called for certification ${id} by ${reviewerId}`);
    try {
      const certification = await this.findPendingOrFail(id);
      certification.status = EmployeeCertificationStatus.Rejected;
      certification.verifiedById = reviewerId; // records who reviewed it
      certification.verifiedAt = new Date();
      certification.rejectionReason = rejectionReason;
      certification.updatedBy = reviewerId;
      const saved = await this.certificationsRepo.saveScoped(certification);
      this.logger.debug(`reject succeeded for certification ${id}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: id,
        action: "update",
        actorId: reviewerId,
        changes: {
          status: { old: EmployeeCertificationStatus.Pending, new: EmployeeCertificationStatus.Rejected },
          rejectionReason: { old: null, new: rejectionReason },
        },
      });
      return saved;
    } catch (err) {
      if (!(err instanceof BadRequestException) && !(err instanceof NotFoundException)) {
        this.logger.error(`reject failed for certification ${id}: ${(err as Error).message}`, (err as Error).stack);
      }
      throw err;
    }
  }

  // Story 1.14 -- certified-employee search for project staffing. Only
  // VERIFIED certifications whose name matches (case-insensitive substring);
  // pending/rejected never appear. Exited employees are excluded -- you
  // can't staff someone who's left -- and expired certs are NOT filtered
  // (the expiry date is surfaced instead, per the AC's fast-follow note).
  async searchVerifiedByName(query: string): Promise<EmployeeCertification[]> {
    this.logger.debug(`searchVerifiedByName called (query="${query}")`);
    try {
      const results = await this.certificationsRepo.findScoped({
        where: { status: EmployeeCertificationStatus.Verified, name: ILike(`%${query}%`) },
        relations: ["employee", "employee.department"],
        order: { name: "ASC" },
      });
      const staffable = results.filter(
        (certification) =>
          certification.employee &&
          certification.employee.employmentStatus !== EmploymentStatus.Terminated &&
          certification.employee.employmentStatus !== EmploymentStatus.Resigned,
      );
      this.logger.debug(
        `searchVerifiedByName returning ${staffable.length} of ${results.length} verified match(es) (exited excluded)`,
      );
      return staffable;
    } catch (err) {
      this.logger.error(`searchVerifiedByName failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async deleteMine(userId: string, id: string): Promise<void> {
    this.logger.debug(`deleteMine called by ${userId} for certification ${id}`);
    try {
      const employeeId = await this.resolveEmployeeId(userId);
      const certification = await this.findOwnedOrFail(id, employeeId);
      // A Verified claim is a locked record (staffing search relies on it).
      // Pending and Rejected are the employee's own to clear.
      if (certification.status === EmployeeCertificationStatus.Verified) {
        this.logger.debug(`deleteMine: certification ${id} is verified, not deletable by employee`);
        throw new ForbiddenException("A verified certification cannot be deleted");
      }
      await this.certificationsRepo.softRemoveScoped(certification, userId);
      this.logger.debug(`deleteMine succeeded for certification ${id}`);
      // Evidence document soft-deleted alongside the certification -- never
      // an S3 delete, the file stays recoverable, matching the client's
      // "certifications need soft delete" call.
      await this.documentsService.clearSingle(DocumentOwnerType.CertificationEvidence, id);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: id,
        action: "delete",
        actorId: userId,
        changes: { name: certification.name, status: certification.status },
      });
    } catch (err) {
      if (!(err instanceof ForbiddenException) && !(err instanceof NotFoundException)) {
        this.logger.error(`deleteMine failed for certification ${id}: ${(err as Error).message}`, (err as Error).stack);
      }
      throw err;
    }
  }
}
