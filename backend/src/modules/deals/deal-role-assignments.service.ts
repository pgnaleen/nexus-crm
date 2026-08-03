import { UserStatus } from "@orelia/common";
import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { TenantContextService } from "../../core/tenant";
import { User } from "../users/entities/user.entity";
import { DealRole } from "./entities/deal-role.entity";
import { DealRoleAssignment } from "./entities/deal-role-assignment.entity";
import { DealsService } from "./deals.service";

const AUDIT_ENTITY_TYPE = "deal_role_assignment";

@Injectable()
export class DealRoleAssignmentsService {
  private readonly logger = new Logger(DealRoleAssignmentsService.name);

  constructor(
    @InjectRepository(DealRoleAssignment) private readonly repo: Repository<DealRoleAssignment>,
    @InjectRepository(DealRole) private readonly rolesRepo: Repository<DealRole>,
    private readonly dealsService: DealsService,
    private readonly auditLogService: AuditLogService,
    private readonly tenantContext: TenantContextService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findAllForDeal(dealId: string): Promise<DealRoleAssignment[]> {
    this.logger.debug(`findAllForDeal called for deal ${dealId}`);
    await this.dealsService.findOneOrFail(dealId);
    const assignments = await this.repo.find({ where: { dealId }, relations: ["role", "user"] });
    this.logger.debug(`findAllForDeal returning ${assignments.length} assignment(s) for deal ${dealId}`);
    return assignments;
  }

  // Bulk lookup for DealsController's toResponse() -- DealResponse.
  // primarySalesPersonUserId/Name are resolved from here, not a deals
  // column. One query for the whole requested set (the Funnel board's bulk
  // deal list), not one per deal.
  async findPrimarySalesPersonMap(dealIds: string[]): Promise<Map<string, { userId: string; displayName: string }>> {
    if (dealIds.length === 0) return new Map();
    const rows = await this.repo
      .createQueryBuilder("assignment")
      .innerJoin("assignment.role", "role")
      .innerJoin("assignment.user", "user")
      .select("assignment.dealId", "dealId")
      .addSelect("assignment.userId", "userId")
      .addSelect("user.displayName", "displayName")
      .where("assignment.isPrimary = true")
      .andWhere("role.requiresPrimaryOnCreate = true")
      .andWhere("assignment.dealId IN (:...dealIds)", { dealIds })
      .getRawMany<{ dealId: string; userId: string; displayName: string }>();
    return new Map(rows.map((row) => [row.dealId, { userId: row.userId, displayName: row.displayName }]));
  }

  // Always inserts with isPrimary=false -- the only two paths that ever set
  // isPrimary=true are DealsService.create()'s atomic initial-Sales-Person
  // insert, and setPrimary() below.
  async assign(dealId: string, roleId: string, userId: string, actorId: string): Promise<DealRoleAssignment> {
    this.logger.debug(`assign called for deal ${dealId} by ${actorId} (roleId=${roleId}, userId=${userId})`);
    await this.dealsService.findOneOrFail(dealId);

    const tenantId = this.tenantContext.getTenantId();
    const role = await this.rolesRepo.findOne({ where: { id: roleId, tenantId } });
    if (!role) {
      this.logger.debug(`Blocked: role ${roleId} not found for this tenant`);
      throw new NotFoundException("roleId does not reference a valid record");
    }
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { id: userId, tenantId, status: UserStatus.Active } });
    if (!user) {
      this.logger.debug(`Blocked: user ${userId} not found or not active for this tenant`);
      throw new NotFoundException("userId does not reference a valid record");
    }

    const existing = await this.repo.findOne({ where: { dealId, roleId, userId } });
    if (existing) {
      this.logger.debug(`Blocked: user ${userId} is already assigned to role ${roleId} on deal ${dealId}`);
      throw new ConflictException("This person is already assigned to this role on this deal");
    }

    try {
      const assignment = this.repo.create({ dealId, roleId, userId, isPrimary: false, createdById: actorId });
      const saved = await this.repo.save(assignment);
      this.logger.debug(`assign succeeded, assignment ${saved.id}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: saved.id,
        action: "insert",
        actorId,
        changes: { dealId, roleId, roleName: role.name, userId, userDisplayName: user.displayName },
      });
      return this.findOneWithRelationsOrFail(dealId, saved.id);
    } catch (err) {
      this.logger.error(`assign failed for deal ${dealId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async remove(dealId: string, assignmentId: string, actorId: string): Promise<void> {
    this.logger.debug(`remove called for assignment ${assignmentId} on deal ${dealId} by ${actorId}`);
    await this.dealsService.findOneOrFail(dealId);
    const assignment = await this.repo.findOne({ where: { id: assignmentId, dealId }, relations: ["role"] });
    if (!assignment) {
      this.logger.debug(`Blocked: assignment ${assignmentId} not found on deal ${dealId}`);
      throw new NotFoundException("Deal team assignment not found");
    }
    if (assignment.isPrimary && assignment.role?.requiresPrimaryOnCreate) {
      this.logger.debug(`Blocked: assignment ${assignmentId} is the mandatory primary for role ${assignment.roleId}`);
      throw new ConflictException(
        "Assign a new primary for this role before removing the current one -- it can't be left unassigned.",
      );
    }
    try {
      await this.repo.remove(assignment);
      this.logger.debug(`remove succeeded for assignment ${assignmentId}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: assignmentId,
        action: "delete",
        actorId,
        changes: { dealId, roleId: assignment.roleId, userId: assignment.userId },
      });
    } catch (err) {
      this.logger.error(`remove failed for assignment ${assignmentId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Promotes an existing assignment to primary for its (deal, role) pair,
  // demoting whichever assignment currently holds it. Both writes happen in
  // one transaction so the partial unique index (deal_id, role_id) WHERE
  // is_primary is never even briefly violated.
  async setPrimary(dealId: string, assignmentId: string, actorId: string): Promise<DealRoleAssignment> {
    this.logger.debug(`setPrimary called for assignment ${assignmentId} on deal ${dealId} by ${actorId}`);
    await this.dealsService.findOneOrFail(dealId);
    const assignment = await this.repo.findOne({ where: { id: assignmentId, dealId } });
    if (!assignment) {
      this.logger.debug(`Blocked: assignment ${assignmentId} not found on deal ${dealId}`);
      throw new NotFoundException("Deal team assignment not found");
    }
    if (assignment.isPrimary) {
      this.logger.debug(`setPrimary: assignment ${assignmentId} is already primary, no-op`);
      return this.findOneWithRelationsOrFail(dealId, assignmentId);
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        const txRepo = manager.getRepository(DealRoleAssignment);
        await txRepo.update({ dealId, roleId: assignment.roleId, isPrimary: true }, { isPrimary: false });
        await txRepo.update({ id: assignmentId }, { isPrimary: true });
      });
      this.logger.debug(`setPrimary succeeded for assignment ${assignmentId}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: assignmentId,
        action: "update",
        actorId,
        changes: { isPrimary: { old: false, new: true } },
      });
      return this.findOneWithRelationsOrFail(dealId, assignmentId);
    } catch (err) {
      this.logger.error(`setPrimary failed for assignment ${assignmentId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  private async findOneWithRelationsOrFail(dealId: string, id: string): Promise<DealRoleAssignment> {
    const assignment = await this.repo.findOne({ where: { id, dealId }, relations: ["role", "user"] });
    if (!assignment) {
      throw new NotFoundException("Deal team assignment not found after write");
    }
    return assignment;
  }
}
