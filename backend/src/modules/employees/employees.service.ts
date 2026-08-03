import { DocumentOwnerType, EmploymentStatus } from "@orelia/common";
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, IsNull } from "typeorm";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { assertKeyBelongsToTenant, EMPLOYEE_CV_SEGMENT, EMPLOYEE_PHOTO_SEGMENT } from "../../core/storage/storage.constants";
import { TenantContextService } from "../../core/tenant";
import { DealRoleAssignment } from "../deals/entities/deal-role-assignment.entity";
import { DocumentsService } from "../documents/documents.service";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { UpdateOrgChartStructureDto } from "./dto/update-org-chart-structure.dto";
import { Employee } from "./entities/employee.entity";
import { EmployeesRepository } from "./employees.repository";

const AUDIT_ENTITY_TYPE = "employee";

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    private readonly employeesRepo: EmployeesRepository,
    private readonly auditLogService: AuditLogService,
    private readonly documentsService: DocumentsService,
    private readonly tenantContext: TenantContextService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findPicker(): Promise<Employee[]> {
    this.logger.debug("findPicker called");
    try {
      const results = await this.employeesRepo.findScoped({ order: { fullName: "ASC" } });
      // Exclude exited employees (Terminated/Resigned) from lookup dropdowns --
      // an ex-employee must not be newly assignable as a deal's Sales Person /
      // Pre-Sales / PMO (or any other picker consumer). Matches the same
      // exclusion findForOrgChart() applies; On-Leave stays selectable, and an
      // employee with no status set is treated as active. Edit forms still show
      // an already-assigned exited person via a client-side fallback.
      const exitedStatuses = [EmploymentStatus.Terminated, EmploymentStatus.Resigned];
      const active = results.filter(
        (employee) => !employee.employmentStatus || !exitedStatuses.includes(employee.employmentStatus),
      );
      this.logger.debug(`findPicker returning ${active.length} active row(s) (of ${results.length} total)`);
      return active;
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
      const tenantSlug = this.tenantContext.getTenantSlug();
      if (dto.profilePhotoUrl) {
        assertKeyBelongsToTenant(dto.profilePhotoUrl, EMPLOYEE_PHOTO_SEGMENT, tenantSlug);
      }
      if (dto.cvUrl) {
        assertKeyBelongsToTenant(dto.cvUrl, EMPLOYEE_CV_SEGMENT, tenantSlug);
      }

      const { cvUrl, profilePhotoUrl, ...employeeFields } = dto;
      const employee = this.employeesRepo.createScoped({
        ...employeeFields,
        createdBy: userId,
      });
      const saved = await this.employeesRepo.saveScoped(employee);

      if (profilePhotoUrl) {
        await this.documentsService.replaceSingle(DocumentOwnerType.EmployeePhoto, saved.id, profilePhotoUrl, userId);
      }
      if (cvUrl) {
        await this.documentsService.replaceSingle(DocumentOwnerType.EmployeeCv, saved.id, cvUrl, userId);
      }
      this.logger.debug(`create succeeded for employee ${saved.id}`);

      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: saved.id,
        action: "insert",
        actorId: userId,
        changes: { ...employeeFields, profilePhotoUrl, cvUrl },
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
      const tenantSlug = this.tenantContext.getTenantSlug();
      if (dto.profilePhotoUrl) {
        assertKeyBelongsToTenant(dto.profilePhotoUrl, EMPLOYEE_PHOTO_SEGMENT, tenantSlug);
      }
      if (dto.cvUrl) {
        assertKeyBelongsToTenant(dto.cvUrl, EMPLOYEE_CV_SEGMENT, tenantSlug);
      }

      // Bare load for the actual mutation -- see findOneBareOrFail's comment.
      const employee = await this.findOneBareOrFail(id);

      // profilePhotoUrl/cvUrl no longer live on the entity -- handled
      // separately via DocumentsService below. Everything else builds the
      // patch as before.
      const patch: Record<string, unknown> = {};
      for (const key of Object.keys(dto)) {
        if (key === "profilePhotoUrl" || key === "cvUrl") continue;
        const value = (dto as unknown as Record<string, unknown>)[key];
        patch[key] = value;
      }

      const employeeAsRecord = employee as unknown as Record<string, unknown>;
      const before: Record<string, unknown> = {};
      for (const key of Object.keys(patch)) {
        before[key] = employeeAsRecord[key];
      }
      const oldPhotoDoc = "profilePhotoUrl" in dto
        ? await this.documentsService.findCurrentScoped(DocumentOwnerType.EmployeePhoto, id)
        : null;
      const oldCvDoc = "cvUrl" in dto
        ? await this.documentsService.findCurrentScoped(DocumentOwnerType.EmployeeCv, id)
        : null;

      Object.assign(employee, patch, { updatedBy: userId });
      await this.employeesRepo.saveScoped(employee);

      // Replace/clear -- photo hard-retires the old one (no history), CV
      // soft-retires (old CVs stay recoverable), per DocumentsService's
      // per-owner-type policy.
      if ("profilePhotoUrl" in dto) {
        if (dto.profilePhotoUrl) {
          await this.documentsService.replaceSingle(DocumentOwnerType.EmployeePhoto, id, dto.profilePhotoUrl, userId);
        } else {
          await this.documentsService.clearSingle(DocumentOwnerType.EmployeePhoto, id);
        }
      }
      if ("cvUrl" in dto) {
        if (dto.cvUrl) {
          await this.documentsService.replaceSingle(DocumentOwnerType.EmployeeCv, id, dto.cvUrl, userId);
        } else {
          await this.documentsService.clearSingle(DocumentOwnerType.EmployeeCv, id);
        }
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
      if ("profilePhotoUrl" in dto && (oldPhotoDoc?.s3Key ?? null) !== (dto.profilePhotoUrl ?? null)) {
        changes.profilePhotoUrl = { old: oldPhotoDoc?.s3Key ?? null, new: dto.profilePhotoUrl ?? null };
      }
      if ("cvUrl" in dto && (oldCvDoc?.s3Key ?? null) !== (dto.cvUrl ?? null)) {
        changes.cvUrl = { old: oldCvDoc?.s3Key ?? null, new: dto.cvUrl ?? null };
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

  // Story 1.7 -- every non-exited employee with the department relation
  // loaded, for the Organization Chart. Exited filtering happens in app code
  // rather than a NOT IN clause: a SQL NOT IN silently drops NULL-status
  // rows too, and BaseTenantRepository.scopeOptions can't take an OR-array
  // where (see findLinkable's comment).
  async findForOrgChart(): Promise<Employee[]> {
    this.logger.debug("findForOrgChart called");
    try {
      const all = await this.employeesRepo.findScoped({
        relations: ["department"],
        order: { fullName: "ASC" },
      });
      const exitedStatuses: (EmploymentStatus | undefined)[] = [
        EmploymentStatus.Terminated,
        EmploymentStatus.Resigned,
      ];
      const results = all.filter((employee) => !exitedStatuses.includes(employee.employmentStatus));
      this.logger.debug(`findForOrgChart returning ${results.length} of ${all.length} row(s) (exited excluded)`);
      return results;
    } catch (err) {
      this.logger.error(`findForOrgChart failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Story 1.8 -- the org chart editor's batch commit: every changed
  // reporting relationship saved together, in one transaction. Validates
  // cross-field rules and cycles server-side even though the UI already
  // blocks them at draw time -- the endpoint is the real boundary.
  async updateOrgChartStructure(dto: UpdateOrgChartStructureDto, userId: string): Promise<void> {
    this.logger.debug(`updateOrgChartStructure called by ${userId} (${dto.changes.length} change(s))`);
    try {
      const all = await this.employeesRepo.findScoped({});
      const byId = new Map(all.map((employee) => [employee.id, employee]));
      const exited = (employee: Employee) =>
        employee.employmentStatus === EmploymentStatus.Terminated ||
        employee.employmentStatus === EmploymentStatus.Resigned;

      // Cross-field + reference validation, change by change.
      const seen = new Set<string>();
      for (const change of dto.changes) {
        if (seen.has(change.employeeId)) {
          throw new BadRequestException("Duplicate employee in change set");
        }
        seen.add(change.employeeId);

        const employee = byId.get(change.employeeId);
        if (!employee || exited(employee)) {
          this.logger.debug(`updateOrgChartStructure: employee ${change.employeeId} missing or exited`);
          throw new BadRequestException("Change set references an unknown or exited employee");
        }
        if (change.placedAtRoot && change.reportingManagerId) {
          throw new BadRequestException("An employee cannot both report to a manager and sit at the root");
        }
        if (change.reportingManagerId) {
          if (change.reportingManagerId === change.employeeId) {
            throw new BadRequestException("An employee cannot report to themselves");
          }
          const manager = byId.get(change.reportingManagerId);
          if (!manager || exited(manager)) {
            this.logger.debug(`updateOrgChartStructure: manager ${change.reportingManagerId} missing or exited`);
            throw new BadRequestException("Change set references an unknown or exited manager");
          }
        }
      }

      // Cycle detection over the WOULD-BE structure: current parents
      // overlaid with the pending changes.
      const pendingParent = new Map<string, string | null>();
      for (const employee of all) {
        pendingParent.set(employee.id, employee.reportingManagerId ?? null);
      }
      for (const change of dto.changes) {
        pendingParent.set(change.employeeId, change.reportingManagerId);
      }
      for (const change of dto.changes) {
        const visited = new Set<string>([change.employeeId]);
        let cursor = change.reportingManagerId;
        while (cursor) {
          if (visited.has(cursor)) {
            this.logger.debug(`updateOrgChartStructure: cycle detected at employee ${cursor}`);
            throw new BadRequestException("The requested structure contains a reporting loop");
          }
          visited.add(cursor);
          cursor = pendingParent.get(cursor) ?? null;
        }
      }

      // Apply only the entries that actually change something.
      const toSave: Employee[] = [];
      const auditEntries: { id: string; changes: Record<string, { old: unknown; new: unknown }> }[] = [];
      for (const change of dto.changes) {
        const employee = byId.get(change.employeeId)!;
        const oldManagerId = employee.reportingManagerId ?? null;
        const oldPlacedAtRoot = employee.placedAtRoot;
        if (oldManagerId === change.reportingManagerId && oldPlacedAtRoot === change.placedAtRoot) {
          this.logger.debug(`updateOrgChartStructure: employee ${change.employeeId} unchanged, skipping`);
          continue;
        }
        (employee as unknown as { reportingManagerId: string | null }).reportingManagerId =
          change.reportingManagerId;
        employee.placedAtRoot = change.placedAtRoot;
        employee.updatedBy = userId;
        toSave.push(employee);
        const diff: Record<string, { old: unknown; new: unknown }> = {};
        if (oldManagerId !== change.reportingManagerId) {
          diff.reportingManagerId = { old: oldManagerId, new: change.reportingManagerId };
        }
        if (oldPlacedAtRoot !== change.placedAtRoot) {
          diff.placedAtRoot = { old: oldPlacedAtRoot, new: change.placedAtRoot };
        }
        auditEntries.push({ id: change.employeeId, changes: diff });
      }

      if (toSave.length === 0) {
        this.logger.debug("updateOrgChartStructure: no effective changes, nothing to save");
        return;
      }

      await this.employeesRepo.saveManyScoped(toSave);
      this.logger.debug(`updateOrgChartStructure saved ${toSave.length} row(s)`);

      for (const entry of auditEntries) {
        await this.auditLogService.record({
          entityType: AUDIT_ENTITY_TYPE,
          entityId: entry.id,
          action: "update",
          actorId: userId,
          changes: entry.changes,
        });
      }
    } catch (err) {
      if (!(err instanceof BadRequestException)) {
        this.logger.error(`updateOrgChartStructure failed: ${(err as Error).message}`, (err as Error).stack);
      }
      throw err;
    }
  }

  // ── Story 1.6: User-account link (employees.user_id) ──────────────────
  // The link is only ever created/changed from User Management -- these
  // methods exist for UsersService to call, never for the employees
  // controller's own routes.

  async findByUserId(userId: string): Promise<Employee | null> {
    this.logger.debug(`findByUserId called for user ${userId}`);
    return this.employeesRepo.findOneScoped({ where: { userId } });
  }

  // Self-service profile photo. The employee record is otherwise HR-controlled
  // and read-only from My Profile; the photo is the one field its own owner may
  // set, so it needs a path that does NOT go through update() -- that method
  // requires EMPLOYEES_UPDATE and accepts every other column.
  //
  // There is no id parameter by design: the target row is resolved from the
  // caller's own user id, so one user physically cannot touch another's photo.
  async updateMyPhoto(userId: string, profilePhotoUrl: string | null): Promise<Employee> {
    this.logger.debug(`updateMyPhoto called by ${userId} (action=${profilePhotoUrl ? "set" : "clear"})`);
    try {
      // Bare load -- no `relations`. This object gets saved below, and saving a
      // relations-loaded entity would null every relation-backed FK on the row
      // (department_id, user_id, reporting_manager_id). See CLAUDE.md's
      // "TypeORM Gotcha" and findOneBareOrFail's comment above.
      const employee = await this.employeesRepo.findOneScoped({ where: { userId } });
      if (!employee) {
        this.logger.debug(`updateMyPhoto: no employee linked to user ${userId}, rejecting`);
        throw new NotFoundException("Your account isn't linked to an employee record");
      }

      if (profilePhotoUrl) {
        // Same tenant-prefix assertion create()/update() apply -- stops a
        // caller pointing their photo at another tenant's object key.
        this.logger.debug(`updateMyPhoto: verifying key ownership for employee ${employee.id}`);
        assertKeyBelongsToTenant(profilePhotoUrl, EMPLOYEE_PHOTO_SEGMENT, this.tenantContext.getTenantSlug());
      }

      // Captured before the swap so the audit row records what was replaced.
      const oldPhotoDoc = await this.documentsService.findCurrentScoped(
        DocumentOwnerType.EmployeePhoto,
        employee.id,
      );

      if (profilePhotoUrl) {
        this.logger.debug(`updateMyPhoto: replacing photo document for employee ${employee.id}`);
        await this.documentsService.replaceSingle(
          DocumentOwnerType.EmployeePhoto,
          employee.id,
          profilePhotoUrl,
          userId,
        );
      } else {
        this.logger.debug(`updateMyPhoto: clearing photo document for employee ${employee.id}`);
        await this.documentsService.clearSingle(DocumentOwnerType.EmployeePhoto, employee.id);
      }

      // The photo itself lives in `documents`, but this is still an edit to the
      // employee -- updatedBy must reflect who made it, per the audit rules.
      employee.updatedBy = userId;
      await this.employeesRepo.saveScoped(employee);

      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: employee.id,
        action: "update",
        actorId: userId,
        changes: {
          profilePhotoUrl: { old: oldPhotoDoc?.s3Key ?? null, new: profilePhotoUrl },
        },
      });

      this.logger.debug(`updateMyPhoto succeeded for employee ${employee.id}`);
      return this.findOneOrFail(employee.id);
    } catch (err) {
      this.logger.error(`updateMyPhoto failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Options for the "link to Employee" picker: unlinked employees, plus (when
  // editing) the one already linked to `forUserId` so the current selection
  // stays displayable. Two queries, not an OR-array `where` --
  // BaseTenantRepository.scopeOptions spreads `where` as an object, so a
  // TypeORM array-where would be silently mangled into numeric keys.
  async findLinkable(forUserId?: string): Promise<Employee[]> {
    this.logger.debug(`findLinkable called (forUserId=${forUserId ?? "none"})`);
    try {
      const unlinkedRaw = await this.employeesRepo.findScoped({
        where: { userId: IsNull() },
        order: { fullName: "ASC" },
      });
      // Exclude exited (Terminated/Resigned) employees from the selectable pool,
      // mirroring findPicker -- an ex-employee must not be newly linkable to a
      // login. The already-linked employee (added below) is exempt so an
      // existing link stays displayable even if that person has since exited.
      const exitedStatuses = [EmploymentStatus.Terminated, EmploymentStatus.Resigned];
      const unlinked = unlinkedRaw.filter(
        (employee) => !employee.employmentStatus || !exitedStatuses.includes(employee.employmentStatus),
      );
      if (!forUserId) {
        this.logger.debug(`findLinkable returning ${unlinked.length} selectable unlinked row(s) (of ${unlinkedRaw.length})`);
        return unlinked;
      }
      const currentlyLinked = await this.findByUserId(forUserId);
      if (!currentlyLinked) {
        this.logger.debug(`findLinkable: no employee linked to user ${forUserId}; returning ${unlinked.length} row(s)`);
        return unlinked;
      }
      this.logger.debug(
        `findLinkable returning ${unlinked.length} unlinked + current employee ${currentlyLinked.id} for user ${forUserId}`,
      );
      return [...unlinked, currentlyLinked].sort((a, b) => a.fullName.localeCompare(b.fullName));
    } catch (err) {
      this.logger.error(`findLinkable failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Link an employee to a user account. ConflictException if the employee is
  // already linked to a *different* account (one employee <-> one login);
  // linking to the same account again is a no-op.
  async linkToUser(employeeId: string, userId: string, actorId: string): Promise<void> {
    this.logger.debug(`linkToUser called: employee ${employeeId} -> user ${userId} by ${actorId}`);
    try {
      const employee = await this.findOneBareOrFail(employeeId);
      if (employee.userId === userId) {
        this.logger.debug(`linkToUser: employee ${employeeId} already linked to user ${userId}, no-op`);
        return;
      }
      if (employee.userId) {
        this.logger.debug(`linkToUser: employee ${employeeId} already linked to different user ${employee.userId}`);
        throw new ConflictException("This employee is already linked to another user account");
      }
      const oldUserId = employee.userId ?? null;
      employee.userId = userId;
      employee.updatedBy = actorId;
      await this.employeesRepo.saveScoped(employee);
      this.logger.debug(`linkToUser succeeded: employee ${employeeId} -> user ${userId}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: employeeId,
        action: "update",
        actorId,
        changes: { userId: { old: oldUserId, new: userId } },
      });
    } catch (err) {
      if (!(err instanceof NotFoundException) && !(err instanceof ConflictException)) {
        this.logger.error(`linkToUser failed for employee ${employeeId}: ${(err as Error).message}`, (err as Error).stack);
      }
      throw err;
    }
  }

  // Clear whichever employee (if any) is linked to this user account.
  async unlinkFromUser(userId: string, actorId: string): Promise<void> {
    this.logger.debug(`unlinkFromUser called for user ${userId} by ${actorId}`);
    try {
      const employee = await this.findByUserId(userId);
      if (!employee) {
        this.logger.debug(`unlinkFromUser: no employee linked to user ${userId}, no-op`);
        return;
      }
      // The entity types the column `string | undefined`, but clearing an FK
      // requires an explicit null (undefined columns are skipped on save).
      (employee as unknown as { userId: string | null }).userId = null;
      employee.updatedBy = actorId;
      await this.employeesRepo.saveScoped(employee);
      this.logger.debug(`unlinkFromUser succeeded: employee ${employee.id} unlinked from user ${userId}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: employee.id,
        action: "update",
        actorId,
        changes: { userId: { old: userId, new: null } },
      });
    } catch (err) {
      this.logger.error(`unlinkFromUser failed for user ${userId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Story 1.5 -- soft delete (deletedAt/deletedBy), same posture as
  // Users/Teams/Departments: recoverable at the DB level, gone from the UI.
  // Distinct from "Mark as Exited" (a plain update of employmentStatus +
  // dateOfExit via update() above), which keeps the record fully visible for
  // compliance/history. Bare load for the mutation target -- same
  // relations-save rule as update().
  // deal_role_assignments is keyed on user_id, not employee_id (see
  // DealRoleAssignment's own comment) -- so this checks deal team
  // assignments held by whichever User this Employee is linked to, not the
  // Employee row itself. An employee with no linked user can't hold any
  // assignment at all. Without this check a deal would be left silently
  // pointing at a now-hidden, soft-deleted Employee's still-active login.
  async countActiveDeals(employeeId: string): Promise<Array<{ roleName: string; count: number }>> {
    const employee = await this.employeesRepo.findOneScoped({ where: { id: employeeId } });
    if (!employee?.userId) {
      return [];
    }
    const rows = await this.dataSource
      .getRepository(DealRoleAssignment)
      .createQueryBuilder("assignment")
      .innerJoin("assignment.role", "role")
      .innerJoin("assignment.deal", "deal")
      .select("role.name", "roleName")
      .addSelect("COUNT(*)", "count")
      .where("assignment.user_id = :userId", { userId: employee.userId })
      .andWhere("deal.deleted_at IS NULL")
      .groupBy("role.name")
      .getRawMany<{ roleName: string; count: string }>();
    return rows.map((row) => ({ roleName: row.roleName, count: Number(row.count) }));
  }

  async remove(id: string, userId: string): Promise<void> {
    this.logger.debug(`remove called for employee ${id} by ${userId}`);
    const employee = await this.findOneBareOrFail(id);

    // A ConflictException here is an expected business-rule rejection, not a
    // system failure -- thrown before the try/catch below so it isn't logged
    // as an error, same as NotFoundException elsewhere.
    const dealCounts = await this.countActiveDeals(id);
    const parts = dealCounts.map((row) => `${row.count} deal(s) as ${row.roleName}`);
    if (parts.length > 0) {
      this.logger.debug(`Blocked: employee ${id} still assigned to deals (${parts.join(", ")})`);
      throw new ConflictException(
        `Cannot delete this employee: currently assigned to ${parts.join(", ")}. Reassign these deals first.`,
      );
    }

    try {
      await this.employeesRepo.softRemoveScoped(employee, userId);
      this.logger.debug(`remove succeeded for employee ${id}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: id,
        action: "delete",
        actorId: userId,
        changes: { fullName: employee.fullName, employeeCode: employee.employeeCode ?? null },
      });
    } catch (err) {
      if (!(err instanceof NotFoundException)) {
        this.logger.error(`remove failed for employee ${id}: ${(err as Error).message}`, (err as Error).stack);
      }
      throw err;
    }
  }
}
