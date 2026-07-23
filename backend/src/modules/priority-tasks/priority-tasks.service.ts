import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { TenantContextService } from "../../core/tenant";
import { User } from "../users/entities/user.entity";
import { CreatePriorityTaskDto } from "./dto/create-priority-task.dto";
import { MovePriorityTaskDto } from "./dto/move-priority-task.dto";
import { UpdatePriorityTaskDto } from "./dto/update-priority-task.dto";
import { PriorityTask } from "./entities/priority-task.entity";
import { PriorityTasksRepository } from "./priority-tasks.repository";

const AUDIT_ENTITY_TYPE = "priority_task";

@Injectable()
export class PriorityTasksService {
  private readonly logger = new Logger(PriorityTasksService.name);

  constructor(
    private readonly priorityTasksRepo: PriorityTasksRepository,
    private readonly auditLogService: AuditLogService,
    private readonly tenantContext: TenantContextService,
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
  ) {}

  // Every user only ever sees their own board -- no permission check, no
  // sharing/delegation to account for yet (Stories 1.5+), so "owned by
  // userId" is the entire access rule for now.
  async findAllForUser(userId: string): Promise<PriorityTask[]> {
    this.logger.debug(`findAllForUser called (userId=${userId})`);
    try {
      const results = await this.priorityTasksRepo.findScoped({
        where: { ownerId: userId },
        order: { rank: "ASC" },
      });
      this.logger.debug(`findAllForUser returning ${results.length} row(s)`);
      return results;
    } catch (err) {
      this.logger.error(`findAllForUser failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Story 1.4 -- single-task detail view. `ownerId === userId` is the whole
  // access rule for now, same as findAllForUser; once Story 1.5 (Share)
  // exists, a merely-shared (not owning) recipient also needs to pass here
  // read-only, so this is the one place that check will need broadening.
  // 404 (not a leaked-existence 403) for "not yours" -- matches the rest of
  // this codebase's tenant/ownership-scoped findOneOrFail conventions.
  async findOneForUser(taskId: string, userId: string): Promise<PriorityTask> {
    this.logger.debug(`findOneForUser called (taskId=${taskId}, userId=${userId})`);
    const task = await this.priorityTasksRepo.findOneScoped({ where: { id: taskId, ownerId: userId } });
    if (!task) {
      this.logger.debug(`Blocked: task ${taskId} not found or not owned by ${userId}`);
      throw new NotFoundException("Task not found");
    }
    return task;
  }

  // Resolves the display name behind a createdBy/ownerId uuid, for the
  // detail view's "who" history entry. Null if that user's account was
  // later deleted (created_by is ON DELETE SET NULL) or was never set.
  async getUserDisplayName(userId: string | undefined): Promise<string | null> {
    if (!userId) return null;
    const user = await this.usersRepo.findOneBy({ id: userId });
    return user?.displayName ?? null;
  }

  // Story 1.4 -- edit notes. Only the current owner may write; enforced by
  // the same ownerId=userId lookup as findOneForUser (a merely-shared
  // recipient, once Story 1.5 exists, reads via findOneForUser but must
  // never reach this method).
  async updateNotes(taskId: string, userId: string, dto: UpdatePriorityTaskDto): Promise<PriorityTask> {
    this.logger.debug(`updateNotes called for task ${taskId} by ${userId}`);
    try {
      const task = await this.priorityTasksRepo.findOneScoped({ where: { id: taskId, ownerId: userId } });
      if (!task) {
        this.logger.debug(`Blocked: task ${taskId} not found or not owned by ${userId}`);
        throw new NotFoundException("Task not found");
      }
      task.notes = dto.notes;
      task.updatedBy = userId;
      const saved = await this.priorityTasksRepo.saveScoped(task);
      this.logger.debug(`updateNotes succeeded for task ${taskId}`);
      return saved;
    } catch (err) {
      this.logger.error(`updateNotes failed for task ${taskId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async create(dto: CreatePriorityTaskDto, userId: string): Promise<PriorityTask> {
    this.logger.debug(`create called by ${userId} (title="${dto.title}", quadrant=${dto.quadrant})`);
    try {
      const rank = await this.nextRank(userId, dto.quadrant);
      this.logger.debug(`Placing at rank ${rank} in quadrant ${dto.quadrant}`);

      const task = this.priorityTasksRepo.createScoped({
        title: dto.title,
        notes: dto.notes,
        quadrant: dto.quadrant,
        rank,
        ownerId: userId,
        createdBy: userId,
      });
      const saved = await this.priorityTasksRepo.saveScoped(task);
      this.logger.debug(`create succeeded for priority task ${saved.id}`);

      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: saved.id,
        action: "insert",
        actorId: userId,
        changes: { title: dto.title, quadrant: dto.quadrant },
      });
      return saved;
    } catch (err) {
      this.logger.error(`create failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Story 1.3 -- move a task to a (possibly new) quadrant at a specific
  // 0-based position, resequencing ranks (1..N, no gaps/duplicates) for
  // every quadrant actually touched. Whole thing runs in one transaction so
  // a failure partway through never leaves ranks half-renumbered.
  // Deliberately no audit_logs entry here -- lifecycle/history recording is
  // Story 1.9's own concern to design properly, not something to bolt on
  // ad hoc for a drag-and-drop reorder that can fire many times a minute.
  async move(taskId: string, userId: string, dto: MovePriorityTaskDto): Promise<PriorityTask> {
    this.logger.debug(`move called for task ${taskId} by ${userId} (quadrant=${dto.quadrant}, index=${dto.index})`);
    const tenantId = this.tenantContext.getTenantId();
    try {
      await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(PriorityTask);
        const task = await repo.findOne({ where: { id: taskId, tenantId, ownerId: userId } });
        if (!task) {
          throw new NotFoundException("Task not found");
        }

        const fromQuadrant = task.quadrant;
        const toQuadrant = dto.quadrant;

        if (fromQuadrant === toQuadrant) {
          this.logger.debug(`Reordering within quadrant ${toQuadrant}`);
          const siblings = await repo.find({
            where: { tenantId, ownerId: userId, quadrant: toQuadrant },
            order: { rank: "ASC" },
          });
          const others = siblings.filter((sibling) => sibling.id !== taskId);
          others.splice(clampIndex(dto.index, others.length), 0, task);
          await this.resequence(repo, others, userId);
        } else {
          this.logger.debug(`Moving task from ${fromQuadrant} to ${toQuadrant}`);
          const oldSiblings = (
            await repo.find({ where: { tenantId, ownerId: userId, quadrant: fromQuadrant }, order: { rank: "ASC" } })
          ).filter((sibling) => sibling.id !== taskId);
          await this.resequence(repo, oldSiblings, userId);

          const newSiblings = await repo.find({
            where: { tenantId, ownerId: userId, quadrant: toQuadrant },
            order: { rank: "ASC" },
          });
          task.quadrant = toQuadrant;
          newSiblings.splice(clampIndex(dto.index, newSiblings.length), 0, task);
          await this.resequence(repo, newSiblings, userId);
        }
      });
      this.logger.debug(`move succeeded for task ${taskId}`);
    } catch (err) {
      this.logger.error(`move failed for task ${taskId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }

    const updated = await this.priorityTasksRepo.findOneScoped({ where: { id: taskId } });
    if (!updated) {
      throw new NotFoundException("Task not found");
    }
    return updated;
  }

  // Deliberately no "skip if rank already matches" optimization -- the
  // moved task's quadrant can change without its numeric rank happening to
  // change too, and these lists are small (one user's own quadrant), so
  // always writing is simpler and safe rather than risking a stale row.
  private async resequence(repo: Repository<PriorityTask>, tasks: PriorityTask[], userId: string): Promise<void> {
    await Promise.all(
      tasks.map((task, index) => {
        task.rank = index + 1;
        task.updatedBy = userId;
        return repo.save(task);
      }),
    );
  }

  // New tasks always land at the bottom of their target quadrant's stack --
  // a plain "current max + 1" is safe here the same way deals.service.ts's
  // dealCode counter is: low-contention, single-user-scoped writes, no lock.
  private async nextRank(userId: string, quadrant: PriorityTask["quadrant"]): Promise<number> {
    const [last] = await this.priorityTasksRepo.findScoped({
      where: { ownerId: userId, quadrant },
      order: { rank: "DESC" },
      take: 1,
    });
    return (last?.rank ?? 0) + 1;
  }
}

function clampIndex(index: number, length: number): number {
  return Math.min(Math.max(index, 0), length);
}
