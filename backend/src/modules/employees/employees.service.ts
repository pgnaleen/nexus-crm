import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
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
}
