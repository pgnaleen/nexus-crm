import { EmployeeCertificationStatus } from "@orelia/common";
import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
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
      const employeeId = await this.resolveEmployeeId(userId);
      // Status is always Pending on creation -- never trust a client to set
      // it; there's no status field on the DTO at all.
      const certification = this.certificationsRepo.createScoped({
        ...dto,
        employeeId,
        status: EmployeeCertificationStatus.Pending,
        createdBy: userId,
      });
      const saved = await this.certificationsRepo.saveScoped(certification);
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
      for (const key of Object.keys(dto)) {
        before[key] = asRecord[key];
      }

      Object.assign(certification, dto, { updatedBy: userId });
      const saved = await this.certificationsRepo.saveScoped(certification);
      this.logger.debug(`updateMine succeeded for certification ${id}`);

      const changes: Record<string, { old: unknown; new: unknown }> = {};
      const savedAsRecord = saved as unknown as Record<string, unknown>;
      for (const key of Object.keys(dto)) {
        if (before[key] !== savedAsRecord[key]) {
          changes[key] = { old: before[key] ?? null, new: savedAsRecord[key] ?? null };
        }
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
