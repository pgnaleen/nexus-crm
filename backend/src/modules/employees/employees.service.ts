import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { deleteUploadedEmployeeFile } from "../uploads/uploaded-file.util";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { Employee } from "./entities/employee.entity";
import { EmployeesRepository } from "./employees.repository";

const AUDIT_ENTITY_TYPE = "employee";

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    private readonly employeesRepo: EmployeesRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findPicker(): Promise<Employee[]> {
    this.logger.debug("findPicker called");
    try {
      const results = await this.employeesRepo.findScoped({ order: { fullName: "ASC" } });
      this.logger.debug(`findPicker returning ${results.length} row(s)`);
      return results;
    } catch (err) {
      this.logger.error(`findPicker failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Full Employee Directory listing (Story 1.1) -- every employee in the
  // tenant, department relation loaded for display. Unlike findPicker(),
  // this is the real admin-gated listing, not a narrow dropdown lookup.
  async findAll(): Promise<Employee[]> {
    this.logger.debug("findAll called");
    try {
      const results = await this.employeesRepo.findScoped({
        relations: ["department"],
        order: { fullName: "ASC" },
      });
      this.logger.debug(`findAll returning ${results.length} row(s)`);
      return results;
    } catch (err) {
      this.logger.error(`findAll failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Story 1.3 -- also loads the linked User (read-only display of which
  // login account this employee is tied to; the link itself is only ever
  // created/changed from User Management, Story 1.6).
  async findOneOrFail(id: string): Promise<Employee> {
    this.logger.debug(`findOneOrFail called for employee ${id}`);
    try {
      const employee = await this.employeesRepo.findOneScoped({
        where: { id },
        relations: ["department", "user"],
      });
      if (!employee) {
        this.logger.debug(`findOneOrFail: employee ${id} not found`);
        throw new NotFoundException("Employee not found");
      }
      this.logger.debug(`findOneOrFail succeeded for employee ${id}`);
      return employee;
    } catch (err) {
      // A not-found employee is an expected outcome (e.g. a stale/guessed
      // id), not a system error -- same treatment this codebase already
      // gives NotFoundException/ConflictException elsewhere. Still always
      // rethrown, never swallowed.
      if (!(err instanceof NotFoundException)) {
        this.logger.error(`findOneOrFail failed for employee ${id}: ${(err as Error).message}`, (err as Error).stack);
      }
      throw err;
    }
  }

  // Bare load for mutation targets -- must not carry loaded relations into
  // saveScoped(). findOneOrFail() above loads department/user relations for
  // response-building; saving THAT object would silently NULL every
  // relation-backed FK on the row (department_id, user_id,
  // reporting_manager_id) -- see CLAUDE.md's "TypeORM Gotcha" and the
  // identical findOneOrFail/findOneBareOrFail split in deals.service.ts.
  private async findOneBareOrFail(id: string): Promise<Employee> {
    const employee = await this.employeesRepo.findOneScoped({ where: { id } });
    if (!employee) {
      this.logger.debug(`findOneBareOrFail: employee ${id} not found`);
      throw new NotFoundException("Employee not found");
    }
    return employee;
  }

  // Story 1.2 -- reportingManagerId is deliberately never set here; every
  // new employee starts unplaced in the reporting structure, set exclusively
  // via the Organization Chart (Story 1.8). Sensitive-field stripping for
  // callers without EMPLOYEES_VIEW_SENSITIVE happens in the controller,
  // before the DTO ever reaches this method.
  async create(dto: CreateEmployeeDto, userId: string): Promise<Employee> {
    this.logger.debug(`create called by ${userId} (fullName="${dto.fullName}")`);
    try {
      const { cvUrl, ...employeeFields } = dto;
      const employee = this.employeesRepo.createScoped({
        ...employeeFields,
        s3Key: cvUrl,
        createdBy: userId,
      });
      const saved = await this.employeesRepo.saveScoped(employee);
      this.logger.debug(`create succeeded for employee ${saved.id}`);

      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: saved.id,
        action: "insert",
        actorId: userId,
        changes: { ...employeeFields, s3Key: cvUrl },
      });

      return this.findOneOrFail(saved.id);
    } catch (err) {
      this.logger.error(`create failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Story 1.4 -- tri-state partial update: a key absent from the dto leaves
  // its column unchanged (the controller `delete`s confidential keys for
  // callers without EMPLOYEES_VIEW_SENSITIVE, so those columns are never
  // assigned or diffed -- an edit can't wipe data the editor can't see);
  // null clears the column; a value sets it. reportingManagerId/userId are
  // not in the dto at all (Org Chart Story 1.8 / User Management Story 1.6
  // own those relationships exclusively).
  async update(id: string, dto: UpdateEmployeeDto, userId: string): Promise<Employee> {
    this.logger.debug(`update called for employee ${id} by ${userId} (fields: ${Object.keys(dto).join(", ") || "none"})`);
    try {
      // Bare load for the actual mutation -- see findOneBareOrFail's comment.
      const employee = await this.findOneBareOrFail(id);

      // The API field is cvUrl; the entity column is s3Key (same rename
      // create() does). Build the patch with entity-column names.
      const patch: Record<string, unknown> = {};
      for (const key of Object.keys(dto)) {
        const value = (dto as unknown as Record<string, unknown>)[key];
        patch[key === "cvUrl" ? "s3Key" : key] = value;
      }

      const employeeAsRecord = employee as unknown as Record<string, unknown>;
      const before: Record<string, unknown> = {};
      for (const key of Object.keys(patch)) {
        before[key] = employeeAsRecord[key];
      }
      const oldPhotoUrl = employee.profilePhotoUrl;
      const oldCvKey = employee.s3Key;

      Object.assign(employee, patch, { updatedBy: userId });
      await this.employeesRepo.saveScoped(employee);

      // Old file cleanup (replace, don't orphan) -- best-effort, after the
      // save has definitely succeeded; a failed unlink never fails the update.
      if ("profilePhotoUrl" in patch && oldPhotoUrl && patch.profilePhotoUrl !== oldPhotoUrl) {
        this.logger.debug(`update: profile photo replaced, removing old file ${oldPhotoUrl}`);
        await deleteUploadedEmployeeFile(oldPhotoUrl);
      }
      if ("s3Key" in patch && oldCvKey && patch.s3Key !== oldCvKey) {
        this.logger.debug(`update: CV replaced, removing old file ${oldCvKey}`);
        await deleteUploadedEmployeeFile(oldCvKey);
      }

      // Re-fetch (with relations) for the response rather than returning the
      // in-memory object -- same reasoning as deals.service.ts::update.
      const updated = await this.findOneOrFail(id);
      this.logger.debug(`update succeeded for employee ${id}`);

      const changes: Record<string, { old: unknown; new: unknown }> = {};
      const updatedAsRecord = updated as unknown as Record<string, unknown>;
      for (const key of Object.keys(patch)) {
        const oldValue = before[key];
        const newValue = updatedAsRecord[key];
        // baseSalary is a Postgres numeric -- TypeORM returns it as a string
        // ("5000.00") while the dto carries a number, so compare numerically
        // to avoid logging a spurious change on every update.
        const unchanged =
          key === "baseSalary"
            ? (oldValue == null && newValue == null) || Number(oldValue) === Number(newValue)
            : oldValue === newValue;
        if (!unchanged) {
          changes[key] = { old: oldValue ?? null, new: newValue ?? null };
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
      } else {
        this.logger.debug(`update for employee ${id}: no effective field changes, skipping audit log`);
      }

      return updated;
    } catch (err) {
      if (!(err instanceof NotFoundException)) {
        this.logger.error(`update failed for employee ${id}: ${(err as Error).message}`, (err as Error).stack);
      }
      throw err;
    }
  }
}
