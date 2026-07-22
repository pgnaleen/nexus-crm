import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";
import { Department } from "./entities/department.entity";
import { DepartmentsRepository } from "./departments.repository";

const AUDIT_ENTITY_TYPE = "department";

@Injectable()
export class DepartmentsService {
  private readonly logger = new Logger(DepartmentsService.name);

  constructor(
    private readonly departmentsRepo: DepartmentsRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(): Promise<Department[]> {
    this.logger.debug("findAll called");
    const results = await this.departmentsRepo.findScoped({ order: { name: "ASC" } });
    this.logger.debug(`findAll returning ${results.length} row(s)`);
    return results;
  }

  // Lightweight, broadly-accessible listing for dropdowns/filters (e.g. the
  // Deals/Funnel department filter) -- unlike findAll(), only active
  // departments make sense to offer when assigning a deal.
  async findPicker(): Promise<Department[]> {
    this.logger.debug("findPicker called");
    try {
      const results = await this.departmentsRepo.findScoped({
        where: { isActive: true },
        order: { name: "ASC" },
      });
      this.logger.debug(`findPicker returning ${results.length} active row(s)`);
      return results;
    } catch (err) {
      this.logger.error(`findPicker failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async findOneOrFail(id: string): Promise<Department> {
    const department = await this.departmentsRepo.findOneScoped({ where: { id } });
    if (!department) {
      throw new NotFoundException("Department not found");
    }
    return department;
  }

  async create(dto: CreateDepartmentDto, userId: string): Promise<Department> {
    this.logger.debug(`create called by ${userId} (name="${dto.name}")`);
    try {
      const department = this.departmentsRepo.createScoped({ ...dto, createdBy: userId });
      const saved = await this.departmentsRepo.saveScoped(department);
      this.logger.debug(`create succeeded for department ${saved.id}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: saved.id,
        action: "insert",
        actorId: userId,
        changes: { ...dto },
      });
      return saved;
    } catch (err) {
      this.logger.error(`create failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async update(id: string, dto: UpdateDepartmentDto, userId: string): Promise<Department> {
    this.logger.debug(`update called for department ${id} by ${userId}`);
    const department = await this.findOneOrFail(id);

    const before: Record<string, unknown> = {};
    const departmentAsRecord = department as unknown as Record<string, unknown>;
    for (const key of Object.keys(dto)) {
      before[key] = departmentAsRecord[key];
    }

    try {
      Object.assign(department, dto, { updatedBy: userId });
      await this.departmentsRepo.saveScoped(department);
      // Re-fetch rather than return the in-memory object -- Object.assign copies
      // omitted dto fields as explicit `undefined`, which would misreport
      // untouched columns as missing in the API response.
      const updated = await this.findOneOrFail(id);
      this.logger.debug(`update succeeded for department ${id}`);

      const changes: Record<string, { old: unknown; new: unknown }> = {};
      const updatedAsRecord = updated as unknown as Record<string, unknown>;
      for (const key of Object.keys(dto)) {
        const newValue = updatedAsRecord[key];
        if (before[key] !== newValue) {
          changes[key] = { old: before[key], new: newValue };
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

      return updated;
    } catch (err) {
      this.logger.error(`update failed for department ${id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    this.logger.debug(`remove called for department ${id} by ${userId}`);
    const department = await this.findOneOrFail(id);
    try {
      await this.departmentsRepo.softRemoveScoped(department, userId);
      this.logger.debug(`remove succeeded for department ${id}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: id,
        action: "delete",
        actorId: userId,
        changes: { name: department.name },
      });
    } catch (err) {
      this.logger.error(`remove failed for department ${id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
