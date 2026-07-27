import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, IsNull, Repository } from "typeorm";
import { PriorityTaskQuadrant, PriorityTaskStatus, UserStatus } from "@orelia/common";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { TenantContextService } from "../../core/tenant";
import { User } from "../users/entities/user.entity";
import { UsersService } from "../users/users.service";
import { CreatePriorityTaskDto } from "./dto/create-priority-task.dto";
import { DelegatePriorityTaskDto } from "./dto/delegate-priority-task.dto";
import { MovePriorityTaskDto } from "./dto/move-priority-task.dto";
import { UpdatePriorityTaskDto } from "./dto/update-priority-task.dto";
import { UpdatePriorityTaskProgressDto } from "./dto/update-priority-task-progress.dto";
import { PriorityTaskDelegationTracker } from "./entities/priority-task-delegation-tracker.entity";
import { PriorityTaskShare } from "./entities/priority-task-share.entity";
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
    private readonly usersService: UsersService,
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(PriorityTaskShare) private readonly sharesRepo: Repository<PriorityTaskShare>,
    @InjectRepository(PriorityTaskDelegationTracker)
    private readonly delegationTrackersRepo: Repository<PriorityTaskDelegationTracker>,
  ) {}

  // Every user only ever sees their own board. A task currently pending
  // delegation (delegatedToUserId set) is deliberately excluded -- its
  // delegator-side tracking card (see findDelegationTrackersForUser)
  // represents it in the DELEGATE quadrant instead, so it would otherwise
  // show up twice.
  async findAllForUser(userId: string): Promise<PriorityTask[]> {
    this.logger.debug(`findAllForUser called (userId=${userId})`);
    try {
      const results = await this.priorityTasksRepo.findScoped({
        where: { ownerId: userId, delegatedToUserId: IsNull() },
        order: { rank: "ASC" },
      });
      this.logger.debug(`findAllForUser returning ${results.length} row(s)`);
      return results;
    } catch (err) {
      this.logger.error(`findAllForUser failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Story 1.4/1.5 -- single-task detail view. Readable by the owner OR
  // anyone the task has been shared with (Story 1.5) -- sharing is
  // read-only visibility, never a write right, so this is deliberately the
  // ONLY access-control method that admits a non-owner. 404 (not a
  // leaked-existence 403) for "neither" -- matches the rest of this
  // codebase's tenant/ownership-scoped findOneOrFail conventions.
  async findOneForUser(taskId: string, userId: string): Promise<PriorityTask> {
    this.logger.debug(`findOneForUser called (taskId=${taskId}, userId=${userId})`);
    const task = await this.priorityTasksRepo.findOneScoped({ where: { id: taskId } });
    if (!task) {
      this.logger.debug(`Blocked: task ${taskId} not found`);
      throw new NotFoundException("Task not found");
    }
    if (task.ownerId === userId) {
      return task;
    }

    const sharedWithCaller = await this.sharesRepo.exists({ where: { taskId, sharedWithUserId: userId } });
    if (!sharedWithCaller) {
      this.logger.debug(`Blocked: task ${taskId} not owned by or shared with ${userId}`);
      throw new NotFoundException("Task not found");
    }
    this.logger.debug(`Read access to task ${taskId} granted to ${userId} via share`);
    return task;
  }

  // Story 1.6 -- the delegator's own board rendering pulls this instead of
  // any real task row for whatever it's delegated away, live-joined to the
  // referenced task's current title/status/progress (the controller
  // separately resolves the recipient's display name).
  async findDelegationTrackersForUser(userId: string): Promise<PriorityTaskDelegationTracker[]> {
    this.logger.debug(`findDelegationTrackersForUser called (userId=${userId})`);
    try {
      const trackers = await this.delegationTrackersRepo.find({
        where: { delegatorId: userId },
        relations: ["task"],
        order: { rank: "ASC" },
      });
      this.logger.debug(`findDelegationTrackersForUser returning ${trackers.length} row(s)`);
      return trackers;
    } catch (err) {
      this.logger.error(`findDelegationTrackersForUser failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Owner-only variant -- every mutation (notes, share management) needs
  // this, never the broader findOneForUser above.
  async findOneOwnedOrFail(taskId: string, userId: string): Promise<PriorityTask> {
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
    // Tenant-scoped: never resolve a display name across the tenant boundary,
    // even though today the id always originates from a same-tenant task's
    // createdBy/ownerId.
    const user = await this.usersRepo.findOne({
      where: { id: userId, tenantId: this.tenantContext.getTenantId() },
    });
    return user?.displayName ?? null;
  }

  // Story 1.4 -- edit notes. Only the current owner may write; enforced by
  // the same ownerId=userId lookup as findOneForUser (a merely-shared
  // recipient, once Story 1.5 exists, reads via findOneForUser but must
  // never reach this method).
  async updateNotes(taskId: string, userId: string, dto: UpdatePriorityTaskDto): Promise<PriorityTask> {
    this.logger.debug(`updateNotes called for task ${taskId} by ${userId}`);
    try {
      const task = await this.findOneOwnedOrFail(taskId, userId);
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

  // Story 1.7 -- the current owner moves progress in 10% steps (0..100).
  // Owner-only (findOneOwnedOrFail); the DTO already rejects non-multiples
  // of 10. The delegator sees the new value the next time they load their
  // own tracking card -- PriorityTaskDelegationTracker live-joins the real
  // task's progress, so nothing extra is written on the delegator side.
  // progress === 100 is the "ready to close" signal (Story 1.10 archive).
  async updateProgress(taskId: string, userId: string, dto: UpdatePriorityTaskProgressDto): Promise<PriorityTask> {
    this.logger.debug(`updateProgress called for task ${taskId} by ${userId} (progress=${dto.progress})`);
    try {
      const task = await this.findOneOwnedOrFail(taskId, userId);
      const previousProgress = task.progress;
      if (previousProgress === dto.progress) {
        this.logger.debug(`updateProgress: task ${taskId} already at ${dto.progress}%, no change`);
        return task;
      }
      task.progress = dto.progress;
      task.updatedBy = userId;
      const saved = await this.priorityTasksRepo.saveScoped(task);
      this.logger.debug(`updateProgress succeeded for task ${taskId} (${previousProgress}% -> ${dto.progress}%)`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: taskId,
        action: "update",
        actorId: userId,
        changes: { progress: { old: previousProgress, new: dto.progress } },
      });
      return saved;
    } catch (err) {
      if (!(err instanceof NotFoundException)) {
        this.logger.error(`updateProgress failed for task ${taskId}: ${(err as Error).message}`, (err as Error).stack);
      }
      throw err;
    }
  }

  // Story 1.6 (send-side only). The real task stays put -- still owned by
  // the delegator, status flips to Delegated, delegatedToUserId records the
  // pending recipient -- until Story 1.8's accept flow transfers ownerId.
  // What visibly moves right now is purely the delegator's own board: the
  // task drops out of its old quadrant's rank sequence (findAllForUser no
  // longer returns it) and a new tracking card takes its place in DELEGATE
  // (see the module-level architecture note on why this is a separate
  // table rather than a schema change to priority_tasks itself).
  async delegate(taskId: string, ownerId: string, dto: DelegatePriorityTaskDto): Promise<PriorityTask> {
    this.logger.debug(`delegate called for task ${taskId} by ${ownerId} (userId=${dto.userId})`);
    if (dto.userId === ownerId) {
      this.logger.debug(`Blocked: cannot delegate task ${taskId} to self`);
      throw new BadRequestException("You can't delegate a task to yourself");
    }

    // Tenant-scoped + active-only, same validation Share applies to its
    // own target user -- a direct API call must not bypass what the picker
    // already filters out.
    const targetUser = await this.usersService.findOneOrFail(dto.userId);
    if (targetUser.status !== UserStatus.Active) {
      this.logger.debug(`Blocked: cannot delegate task ${taskId} to non-active user ${dto.userId}`);
      throw new BadRequestException("You can only delegate to active users");
    }

    const tenantId = this.tenantContext.getTenantId();
    let previousStatus: PriorityTaskStatus | undefined;
    try {
      await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(PriorityTask);
        const trackerRepo = manager.getRepository(PriorityTaskDelegationTracker);
        const lock = { mode: "pessimistic_write" as const };

        const task = await repo.findOne({ where: { id: taskId, tenantId, ownerId }, lock });
        if (!task) {
          throw new NotFoundException("Task not found");
        }
        if (task.delegatedToUserId) {
          this.logger.debug(`Blocked: task ${taskId} is already delegated, pending acceptance`);
          throw new ConflictException("This task is already delegated, pending acceptance");
        }

        this.logger.debug(`Removing task ${taskId} from its current quadrant (${task.quadrant}) rank sequence`);
        const siblings = (
          await repo.find({ where: { tenantId, ownerId, quadrant: task.quadrant }, order: { rank: "ASC" }, lock })
        ).filter((sibling) => sibling.id !== taskId);
        await this.resequence(repo, siblings, ownerId);

        previousStatus = task.status;
        task.status = PriorityTaskStatus.Delegated;
        task.delegatedToUserId = dto.userId;
        task.updatedBy = ownerId;
        await repo.save(task);

        const [lastTracker] = await trackerRepo.find({
          where: { delegatorId: ownerId },
          order: { rank: "DESC" },
          take: 1,
          lock,
        });
        const tracker = trackerRepo.create({
          taskId,
          delegatorId: ownerId,
          quadrant: PriorityTaskQuadrant.Delegate,
          rank: (lastTracker?.rank ?? 0) + 1,
          createdBy: ownerId,
        });
        await trackerRepo.save(tracker);
      });
      this.logger.debug(`delegate succeeded for task ${taskId}`);
    } catch (err) {
      this.logger.error(`delegate failed for task ${taskId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }

    await this.auditLogService.record({
      entityType: AUDIT_ENTITY_TYPE,
      entityId: taskId,
      action: "update",
      actorId: ownerId,
      changes: {
        status: { old: previousStatus ?? null, new: PriorityTaskStatus.Delegated },
        delegatedToUserId: { old: null, new: dto.userId },
        delegatedToName: targetUser.displayName,
      },
    });

    const updated = await this.priorityTasksRepo.findOneScoped({ where: { id: taskId } });
    if (!updated) {
      throw new NotFoundException("Task not found");
    }
    return updated;
  }

  async create(dto: CreatePriorityTaskDto, userId: string): Promise<PriorityTask> {
    this.logger.debug(`create called by ${userId} (title="${dto.title}", quadrant=${dto.quadrant})`);
    const tenantId = this.tenantContext.getTenantId();
    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(PriorityTask);
        // Lock the quadrant's existing rows so two concurrent creates can't
        // both read the same max rank and collide on the next rank. An empty
        // quadrant has no rows to lock -- the rare empty-quadrant double-create
        // is deliberately left to a future unique constraint (out of scope for
        // the "lock only" hardening chosen for this board).
        const [last] = await repo.find({
          where: { tenantId, ownerId: userId, quadrant: dto.quadrant },
          order: { rank: "DESC" },
          take: 1,
          lock: { mode: "pessimistic_write" },
        });
        const rank = (last?.rank ?? 0) + 1;
        this.logger.debug(`Placing at rank ${rank} in quadrant ${dto.quadrant}`);

        // Set status/progress/updatedBy explicitly rather than relying on DB
        // column defaults -- TypeORM does not back-populate plain defaults into
        // the returned entity, so the create response would otherwise emit them
        // as undefined (AC 1.2: status Placed, progress 0%), and updatedBy must
        // never be left null on insert (audit rule).
        const task = this.priorityTasksRepo.createScoped({
          title: dto.title,
          notes: dto.notes,
          quadrant: dto.quadrant,
          rank,
          ownerId: userId,
          createdBy: userId,
          updatedBy: userId,
          status: PriorityTaskStatus.Placed,
          progress: 0,
        });
        return repo.save(task);
      });
      this.logger.debug(`create succeeded for priority task ${saved.id}`);

      // Full snapshot on insert (audit rule): record every persisted field, not
      // just title/quadrant, so the audit trail can reconstruct the created row.
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: saved.id,
        action: "insert",
        actorId: userId,
        changes: {
          title: saved.title,
          notes: saved.notes ?? null,
          quadrant: saved.quadrant,
          rank: saved.rank,
          ownerId: saved.ownerId,
          status: saved.status,
          progress: saved.progress,
        },
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
        // pessimistic_write (SELECT ... FOR UPDATE) on every row this move
        // reads: a second concurrent reorder of the same quadrant (e.g. the
        // board open in two tabs) blocks until this transaction commits, then
        // reads the already-renumbered rows -- closing the read-then-write
        // lost-update race that would otherwise duplicate/scramble ranks.
        const lock = { mode: "pessimistic_write" as const };
        const task = await repo.findOne({ where: { id: taskId, tenantId, ownerId: userId }, lock });
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
            lock,
          });
          const others = siblings.filter((sibling) => sibling.id !== taskId);
          others.splice(clampIndex(dto.index, others.length), 0, task);
          await this.resequence(repo, others, userId);
        } else {
          this.logger.debug(`Moving task from ${fromQuadrant} to ${toQuadrant}`);
          const oldSiblings = (
            await repo.find({
              where: { tenantId, ownerId: userId, quadrant: fromQuadrant },
              order: { rank: "ASC" },
              lock,
            })
          ).filter((sibling) => sibling.id !== taskId);
          await this.resequence(repo, oldSiblings, userId);

          const newSiblings = await repo.find({
            where: { tenantId, ownerId: userId, quadrant: toQuadrant },
            order: { rank: "ASC" },
            lock,
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
    // Sequential await, NOT Promise.all: `repo` is bound to the single
    // transactional connection (one QueryRunner), which cannot execute these
    // saves concurrently -- parallel writes on one connection interleave or
    // throw ("another query is already in progress") and corrupt the very rank
    // sequence this transaction exists to protect. These lists are one user's
    // own quadrant (small), so sequential writes cost nothing meaningful.
    for (const [index, task] of tasks.entries()) {
      task.rank = index + 1;
      task.updatedBy = userId;
      await repo.save(task);
    }
  }
}

function clampIndex(index: number, length: number): number {
  return Math.min(Math.max(index, 0), length);
}
