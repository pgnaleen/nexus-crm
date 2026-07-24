import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { UserStatus } from "@orelia/common";
import { Repository } from "typeorm";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { UsersService } from "../users/users.service";
import { CreatePriorityTaskShareDto } from "./dto/create-priority-task-share.dto";
import { PriorityTaskShare } from "./entities/priority-task-share.entity";
import { PriorityTasksService } from "./priority-tasks.service";

const AUDIT_ENTITY_TYPE = "priority_task_share";

@Injectable()
export class PriorityTaskSharesService {
  private readonly logger = new Logger(PriorityTaskSharesService.name);

  constructor(
    @InjectRepository(PriorityTaskShare) private readonly repo: Repository<PriorityTaskShare>,
    private readonly priorityTasksService: PriorityTasksService,
    private readonly usersService: UsersService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // Only the owner may see who a task is shared with -- same access rule as
  // every other mutation-adjacent read in this module.
  async findAll(taskId: string, ownerId: string): Promise<PriorityTaskShare[]> {
    this.logger.debug(`findAll called for task ${taskId} by ${ownerId}`);
    await this.priorityTasksService.findOneOwnedOrFail(taskId, ownerId);
    const shares = await this.repo.find({ where: { taskId }, relations: ["sharedWithUser"], order: { createdAt: "ASC" } });
    this.logger.debug(`findAll returning ${shares.length} share(s) for task ${taskId}`);
    return shares;
  }

  async add(taskId: string, ownerId: string, dto: CreatePriorityTaskShareDto): Promise<PriorityTaskShare> {
    this.logger.debug(`add called for task ${taskId} by ${ownerId} (userId=${dto.userId})`);
    await this.priorityTasksService.findOneOwnedOrFail(taskId, ownerId);

    // Can't share a task with yourself -- the picker excludes the caller, but a
    // direct API call would otherwise write a junk self-share row.
    if (dto.userId === ownerId) {
      this.logger.debug(`Blocked: cannot share task ${taskId} with self`);
      throw new BadRequestException("You can't share a task with yourself");
    }

    // Tenant-scoped lookup -- without this, an owner could share with an
    // arbitrary uuid from outside the tenant.
    const targetUser = await this.usersService.findOneOrFail(dto.userId);

    // Active accounts only -- mirrors the picker's own status filter, which a
    // direct API call (bypassing the picker) would otherwise sidestep.
    if (targetUser.status !== UserStatus.Active) {
      this.logger.debug(`Blocked: cannot share task ${taskId} with non-active user ${dto.userId}`);
      throw new BadRequestException("You can only share with active users");
    }

    const existing = await this.repo.findOne({ where: { taskId, sharedWithUserId: dto.userId } });
    if (existing) {
      this.logger.debug(`Blocked: task ${taskId} is already shared with ${dto.userId}`);
      throw new ConflictException("Task is already shared with this person");
    }

    try {
      const share = this.repo.create({ taskId, sharedWithUserId: dto.userId, createdBy: ownerId });
      const saved = await this.repo.save(share);
      this.logger.debug(`add succeeded, share ${saved.id}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: saved.id,
        action: "insert",
        actorId: ownerId,
        changes: { taskId, sharedWithUserId: dto.userId, sharedWithName: targetUser.displayName },
      });
      saved.sharedWithUser = targetUser;
      return saved;
    } catch (err) {
      // The existence check above is not atomic: two concurrent shares of the
      // same user race past it and one hits the
      // UNIQUE(task_id, shared_with_user_id) constraint. Translate that Postgres
      // unique-violation (23505) into a clean 409 rather than a raw 500.
      if ((err as { code?: string }).code === "23505") {
        this.logger.debug(`Concurrent duplicate share for task ${taskId} / user ${dto.userId} -> 409`);
        throw new ConflictException("Task is already shared with this person");
      }
      this.logger.error(`add failed for task ${taskId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async remove(taskId: string, ownerId: string, shareId: string): Promise<void> {
    this.logger.debug(`remove called for share ${shareId} on task ${taskId} by ${ownerId}`);
    await this.priorityTasksService.findOneOwnedOrFail(taskId, ownerId);
    const share = await this.repo.findOne({ where: { id: shareId, taskId } });
    if (!share) {
      this.logger.debug(`Blocked: share ${shareId} not found on task ${taskId}`);
      throw new NotFoundException("Share not found");
    }
    try {
      await this.repo.remove(share);
      this.logger.debug(`remove succeeded for share ${shareId}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: shareId,
        action: "delete",
        actorId: ownerId,
        changes: { taskId, sharedWithUserId: share.sharedWithUserId },
      });
    } catch (err) {
      this.logger.error(`remove failed for share ${shareId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
