import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, IsNull, Not, Repository } from "typeorm";
import {
  IncomingTaskResponse,
  PriorityTaskHistoryEntry,
  PriorityTaskQuadrant,
  PriorityTaskStatus,
  UserStatus,
} from "@orelia/common";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { TenantContextService } from "../../core/tenant";
import { User } from "../users/entities/user.entity";
import { UsersService } from "../users/users.service";
import { AcceptPriorityTaskDto } from "./dto/accept-priority-task.dto";
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
      // Story 1.10 -- archived tasks drop off the active board (they live in
      // the Archive view instead).
      const results = await this.priorityTasksRepo.findScoped({
        where: { ownerId: userId, delegatedToUserId: IsNull(), status: Not(PriorityTaskStatus.Archived) },
        order: { rank: "ASC" },
      });
      this.logger.debug(`findAllForUser returning ${results.length} row(s)`);
      return results;
    } catch (err) {
      this.logger.error(`findAllForUser failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Story 2.3 -- the board card shows a "Shared" pill whenever the owner has
  // shared a task with anyone. Batched so rendering N cards costs one query
  // rather than N. No deletedAt filter: priority_task_shares is a bare join
  // table with no soft-delete (an unshare hard-removes the row) -- see the
  // entity's own comment and CLAUDE.md's join-table exemption.
  async countSharesByTaskIds(taskIds: string[]): Promise<Map<string, number>> {
    this.logger.debug(`countSharesByTaskIds called (${taskIds.length} task id(s))`);
    if (taskIds.length === 0) {
      this.logger.debug("No task ids supplied, skipping the query and returning an empty map");
      return new Map();
    }
    try {
      const rows = await this.sharesRepo
        .createQueryBuilder("share")
        .select("share.taskId", "taskId")
        .addSelect("COUNT(*)", "count")
        .where("share.taskId IN (:...taskIds)", { taskIds })
        .groupBy("share.taskId")
        .getRawMany<{ taskId: string; count: string }>();
      this.logger.debug(`countSharesByTaskIds found shares on ${rows.length} of ${taskIds.length} task(s)`);
      return new Map(rows.map((row) => [row.taskId, Number(row.count)]));
    } catch (err) {
      this.logger.error(`countSharesByTaskIds failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Single-task variant, for the response mappers that only ever hold one
  // task (create/update/move/complete/...).
  async countSharesForTask(taskId: string): Promise<number> {
    this.logger.debug(`countSharesForTask called (taskId=${taskId})`);
    try {
      const count = await this.sharesRepo.count({ where: { taskId } });
      this.logger.debug(`countSharesForTask found ${count} share(s) on task ${taskId}`);
      return count;
    } catch (err) {
      this.logger.error(`countSharesForTask failed: ${(err as Error).message}`, (err as Error).stack);
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
    if (sharedWithCaller) {
      this.logger.debug(`Read access to task ${taskId} granted to ${userId} via share`);
      return task;
    }

    // Story 2.4 -- a delegator holding a tracking card must be able to open
    // it. Once the recipient accepts, ownerId transfers to them and the
    // delegator is neither owner nor share-recipient, so the two checks above
    // would 404 them out of their own tracking card. Read-only regardless:
    // the response's `canEdit` stays false for them, and every mutation still
    // goes through findOneOwnedOrFail, which this does not widen.
    const tracksCaller = await this.delegationTrackersRepo.exists({ where: { taskId, delegatorId: userId } });
    if (tracksCaller) {
      this.logger.debug(`Read access to task ${taskId} granted to ${userId} via delegation tracker`);
      return task;
    }

    // Story 2.9 -- a pending delegation recipient must be able to read the
    // task before deciding to accept or pass it on. Until they accept, they
    // are not the owner, not a share recipient, and hold no tracker, so every
    // check above turns them away from an item sitting in their own Incoming
    // panel. Read-only: `canEdit` is false for them (ownerId is still the
    // delegator's), and accept/redelegate keep their own separate guards.
    if (task.delegatedToUserId === userId) {
      this.logger.debug(`Read access to task ${taskId} granted to ${userId} as the pending delegate`);
      return task;
    }

    this.logger.debug(
      `Blocked: task ${taskId} not owned by, shared with, delegated by, or delegated to ${userId}`,
    );
    throw new NotFoundException("Task not found");
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
      // Story 2.10 -- drop any tracker whose task no longer resolves. This
      // used to be treated as impossible (the FK is ON DELETE CASCADE), and
      // the controller threw on it. Soft-delete broke that invariant: a
      // soft-deleted task never fires the cascade, and TypeORM filters it out
      // of this join, so `task` comes back undefined. remove() clears the
      // trackers itself; this is the belt-and-braces half, because the cost
      // of being wrong is a 500 on the delegator's entire board.
      const live = trackers.filter((tracker) => Boolean(tracker.task));
      if (live.length !== trackers.length) {
        this.logger.debug(`Skipped ${trackers.length - live.length} tracker(s) whose task is gone`);
      }
      this.logger.debug(`findDelegationTrackersForUser returning ${live.length} row(s)`);
      return live;
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

  // Story 1.9 -- the task's lifecycle history, derived from the existing
  // audit_logs trail. Access-gated exactly like the detail view
  // (findOneForUser: owner or a share recipient); a stranger gets 404.
  async getHistory(taskId: string, userId: string): Promise<PriorityTaskHistoryEntry[]> {
    this.logger.debug(`getHistory called for task ${taskId} by ${userId}`);
    await this.findOneForUser(taskId, userId); // access check (throws 404 if none)
    const rows = await this.auditLogService.findForEntity(AUDIT_ENTITY_TYPE, taskId);
    const entries: PriorityTaskHistoryEntry[] = [];
    for (const row of rows) {
      const mapped = this.mapAuditRow(row.action, (row.changes ?? {}) as Record<string, unknown>);
      if (!mapped) continue; // skip updates that aren't a lifecycle event (e.g. notes)
      entries.push({
        kind: mapped.kind,
        detail: mapped.detail,
        actorName: await this.getUserDisplayName(row.actorId),
        timestamp: row.occurredAt.toISOString(),
      });
    }
    this.logger.debug(`getHistory returning ${entries.length} entry(ies) for task ${taskId}`);
    return entries;
  }

  private mapAuditRow(
    action: string,
    changes: Record<string, unknown>,
  ): { kind: PriorityTaskHistoryEntry["kind"]; detail: string | null } | null {
    if (action === "insert") return { kind: "created", detail: null };
    if (action !== "update") return null;

    const statusChange = changes.status as { old?: string; new?: string } | undefined;
    const delegatedToName = typeof changes.delegatedToName === "string" ? changes.delegatedToName : null;

    if (statusChange?.new === PriorityTaskStatus.Delegated) return { kind: "delegated", detail: delegatedToName };
    if (statusChange?.new === PriorityTaskStatus.Accepted) return { kind: "accepted", detail: null };
    if (statusChange?.new === PriorityTaskStatus.Completed) return { kind: "completed", detail: null };
    if (statusChange?.new === PriorityTaskStatus.Archived) return { kind: "archived", detail: null };
    // Restore (Story 1.10) records status archived -> placed.
    if (statusChange?.old === PriorityTaskStatus.Archived && statusChange?.new === PriorityTaskStatus.Placed) {
      return { kind: "restored", detail: null };
    }
    // Re-delegation: delegatedToUserId moved without a status change.
    if ("delegatedToUserId" in changes && !statusChange) return { kind: "redelegated", detail: delegatedToName };
    // Progress update.
    const progressChange = changes.progress as { new?: number } | undefined;
    if (progressChange && typeof progressChange.new === "number") {
      return { kind: "progress", detail: String(progressChange.new) };
    }
    return null;
  }

  // Story 2.10 -- permanently clear an archived task out of the Archive.
  // SOFT delete (deletedAt/deletedBy + an audit row), never a hard DELETE:
  // the row stays in the table and simply stops being returned anywhere, per
  // CLAUDE.md's audit rules.
  //
  // Restricted to Archived tasks on purpose. A live task can be pending
  // delegation or shared, and soft-deleting one would yank it out of another
  // user's Incoming panel -- a cross-user side effect that Story 1.10's
  // "archiving is scoped to my own perspective" rule exists to prevent. An
  // archived task has already left every board, so there is nothing to yank.
  async remove(taskId: string, userId: string): Promise<void> {
    this.logger.debug(`remove called for task ${taskId} by ${userId}`);
    const task = await this.findOneOwnedOrFail(taskId, userId);
    if (task.status !== PriorityTaskStatus.Archived) {
      this.logger.debug(`Blocked: task ${taskId} is ${task.status}, only an archived task can be deleted`);
      throw new ConflictException("Only an archived task can be deleted");
    }

    let removedTrackers = 0;
    let removedShares = 0;
    try {
      await this.dataSource.transaction(async (manager) => {
        const taskRepo = manager.getRepository(PriorityTask);
        const trackerRepo = manager.getRepository(PriorityTaskDelegationTracker);
        const shareRepo = manager.getRepository(PriorityTaskShare);

        // Both FKs are ON DELETE CASCADE, which a soft-delete never fires --
        // so these must be cleared explicitly. Leaving a tracker behind is
        // not cosmetic: findDelegationTrackersForUser eager-loads `task`, and
        // an orphaned tracker would 500 the delegator's whole board.
        const trackers = await trackerRepo.find({ where: { taskId } });
        if (trackers.length > 0) {
          this.logger.debug(`Cascading hard-delete to ${trackers.length} delegation tracker(s)`);
          await trackerRepo.remove(trackers);
          removedTrackers = trackers.length;
        }

        const shares = await shareRepo.find({ where: { taskId } });
        if (shares.length > 0) {
          this.logger.debug(`Cascading hard-delete to ${shares.length} share row(s)`);
          await shareRepo.remove(shares);
          removedShares = shares.length;
        }

        // Two steps because softRemove() sets deletedAt but not deletedBy --
        // same pattern as deals.service.ts's own remove().
        await taskRepo.softRemove(task);
        await taskRepo.update(task.id, { deletedBy: userId });
      });
      this.logger.debug(`remove succeeded for task ${taskId}`);
    } catch (err) {
      this.logger.error(`remove failed for task ${taskId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }

    await this.auditLogService.record({
      entityType: AUDIT_ENTITY_TYPE,
      entityId: taskId,
      action: "delete",
      actorId: userId,
      changes: {
        title: task.title,
        quadrant: task.quadrant,
        status: task.status,
        progress: task.progress,
        removedDelegationTrackers: removedTrackers,
        removedShares,
      },
    });
  }

  // Story 1.10 -- the owner's archived tasks, for the Archive view. Off the
  // active board (findAllForUser excludes Archived), but fully intact.
  async findArchivedForUser(userId: string): Promise<PriorityTask[]> {
    this.logger.debug(`findArchivedForUser called (userId=${userId})`);
    try {
      const results = await this.priorityTasksRepo.findScoped({
        where: { ownerId: userId, status: PriorityTaskStatus.Archived },
        order: { updatedAt: "DESC" },
      });
      this.logger.debug(`findArchivedForUser returning ${results.length} row(s)`);
      return results;
    } catch (err) {
      this.logger.error(`findArchivedForUser failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Story 1.10 -- archive a Completed task off my active board. Owner-only;
  // only a Completed task may be archived (the Archive button is hidden
  // otherwise, and this is the server-side guard). Archiving is scoped to my
  // own copy -- it never touches anyone the task was shared/delegated with.
  async archive(taskId: string, userId: string): Promise<PriorityTask> {
    this.logger.debug(`archive called for task ${taskId} by ${userId}`);
    try {
      const task = await this.findOneOwnedOrFail(taskId, userId);
      if (task.status !== PriorityTaskStatus.Completed) {
        this.logger.debug(`Blocked: task ${taskId} is ${task.status}, only a completed task can be archived`);
        throw new BadRequestException("Only a completed task can be archived");
      }
      task.status = PriorityTaskStatus.Archived;
      task.updatedBy = userId;
      const saved = await this.priorityTasksRepo.saveScoped(task);
      this.logger.debug(`archive succeeded for task ${taskId}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: taskId,
        action: "update",
        actorId: userId,
        changes: { status: { old: PriorityTaskStatus.Completed, new: PriorityTaskStatus.Archived } },
      });
      return saved;
    } catch (err) {
      if (!(err instanceof NotFoundException) && !(err instanceof BadRequestException)) {
        this.logger.error(`archive failed for task ${taskId}: ${(err as Error).message}`, (err as Error).stack);
      }
      throw err;
    }
  }

  // Story 1.10 -- restore an archived task to the active board, back into the
  // quadrant it was last in (its quadrant column was never changed on
  // archive) at the next free rank there, status back to Placed. Owner-only.
  async restore(taskId: string, userId: string): Promise<PriorityTask> {
    this.logger.debug(`restore called for task ${taskId} by ${userId}`);
    const tenantId = this.tenantContext.getTenantId();
    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(PriorityTask);
        const lock = { mode: "pessimistic_write" as const };
        const task = await repo.findOne({ where: { id: taskId, tenantId, ownerId: userId }, lock });
        if (!task) {
          throw new NotFoundException("Task not found");
        }
        if (task.status !== PriorityTaskStatus.Archived) {
          throw new BadRequestException("Only an archived task can be restored");
        }
        const [last] = await repo.find({
          where: { tenantId, ownerId: userId, quadrant: task.quadrant, status: Not(PriorityTaskStatus.Archived) },
          order: { rank: "DESC" },
          take: 1,
          lock,
        });
        task.status = PriorityTaskStatus.Placed;
        task.rank = (last?.rank ?? 0) + 1;
        task.updatedBy = userId;
        return repo.save(task);
      });
      this.logger.debug(`restore succeeded for task ${taskId}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: taskId,
        action: "update",
        actorId: userId,
        changes: { status: { old: PriorityTaskStatus.Archived, new: PriorityTaskStatus.Placed } },
      });
      return saved;
    } catch (err) {
      if (!(err instanceof NotFoundException) && !(err instanceof BadRequestException)) {
        this.logger.error(`restore failed for task ${taskId}: ${(err as Error).message}`, (err as Error).stack);
      }
      throw err;
    }
  }

  // Story 1.9 -- the owner marks the work done. A Completed task is the one
  // thing Story 1.10's archive accepts.
  async complete(taskId: string, userId: string): Promise<PriorityTask> {
    this.logger.debug(`complete called for task ${taskId} by ${userId}`);
    try {
      const task = await this.findOneOwnedOrFail(taskId, userId);
      const previousStatus = task.status;
      task.status = PriorityTaskStatus.Completed;
      task.updatedBy = userId;
      const saved = await this.priorityTasksRepo.saveScoped(task);
      this.logger.debug(`complete succeeded for task ${taskId}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: taskId,
        action: "update",
        actorId: userId,
        changes: { status: { old: previousStatus, new: PriorityTaskStatus.Completed } },
      });
      return saved;
    } catch (err) {
      if (!(err instanceof NotFoundException)) {
        this.logger.error(`complete failed for task ${taskId}: ${(err as Error).message}`, (err as Error).stack);
      }
      throw err;
    }
  }

  // Story 1.8 -- everything shared with OR delegated to the caller, as one
  // merged list for the Incoming panel. Delegated items are tasks currently
  // pending the caller's acceptance (delegatedToUserId === caller); shared
  // items come from the join table. fromName is who sent it.
  async findIncomingForUser(userId: string): Promise<IncomingTaskResponse[]> {
    this.logger.debug(`findIncomingForUser called (userId=${userId})`);
    try {
      const delegated = await this.priorityTasksRepo.findScoped({
        where: { delegatedToUserId: userId },
        order: { createdAt: "DESC" },
      });
      const shares = await this.sharesRepo.find({
        where: { sharedWithUserId: userId },
        relations: ["task"],
        order: { createdAt: "DESC" },
      });

      const items: IncomingTaskResponse[] = [];
      for (const task of delegated) {
        items.push({
          id: task.id,
          title: task.title,
          kind: "delegated",
          fromName: (await this.getUserDisplayName(task.delegatedByUserId)) ?? "",
          status: task.status,
          progress: task.progress,
          createdAt: task.createdAt.toISOString(),
          notes: task.notes ?? null,
        });
      }
      for (const share of shares) {
        if (!share.task) continue; // FK CASCADE should prevent this
        items.push({
          id: share.task.id,
          title: share.task.title,
          kind: "shared",
          fromName: (await this.getUserDisplayName(share.createdBy)) ?? "",
          status: share.task.status,
          progress: share.task.progress,
          createdAt: share.createdAt.toISOString(),
          notes: share.task.notes ?? null,
        });
      }
      this.logger.debug(`findIncomingForUser returning ${items.length} item(s)`);
      return items;
    } catch (err) {
      this.logger.error(`findIncomingForUser failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Story 1.8 -- accept a task delegated to me: ownership transfers to me and
  // it lands on my board in the chosen quadrant. The original delegator's
  // tracking card persists (it live-joins the task, now owned by me, so they
  // keep seeing its progress). Only the pending recipient may accept.
  async accept(taskId: string, userId: string, dto: AcceptPriorityTaskDto): Promise<PriorityTask> {
    this.logger.debug(`accept called for task ${taskId} by ${userId} (quadrant=${dto.quadrant})`);
    const tenantId = this.tenantContext.getTenantId();
    let previousOwnerId: string | undefined;
    try {
      await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(PriorityTask);
        const lock = { mode: "pessimistic_write" as const };
        const task = await repo.findOne({ where: { id: taskId, tenantId }, lock });
        if (!task || task.delegatedToUserId !== userId) {
          this.logger.debug(`Blocked: task ${taskId} is not pending acceptance by ${userId}`);
          throw new NotFoundException("Task not found");
        }
        const [last] = await repo.find({
          where: { tenantId, ownerId: userId, quadrant: dto.quadrant },
          order: { rank: "DESC" },
          take: 1,
          lock,
        });
        previousOwnerId = task.ownerId;
        task.ownerId = userId;
        task.quadrant = dto.quadrant;
        task.rank = (last?.rank ?? 0) + 1;
        task.status = PriorityTaskStatus.Accepted;
        // MUST be null, not undefined: TypeORM's save() skips undefined
        // columns ("leave unchanged"), so undefined would leave the task
        // still flagged as pending-delegation -- it would stay in the
        // acceptor's Incoming and never appear on their board. null clears.
        (task as unknown as { delegatedToUserId: string | null }).delegatedToUserId = null;
        (task as unknown as { delegatedByUserId: string | null }).delegatedByUserId = null;
        task.updatedBy = userId;
        await repo.save(task);
      });
      this.logger.debug(`accept succeeded for task ${taskId}`);
    } catch (err) {
      if (!(err instanceof NotFoundException)) {
        this.logger.error(`accept failed for task ${taskId}: ${(err as Error).message}`, (err as Error).stack);
      }
      throw err;
    }

    await this.auditLogService.record({
      entityType: AUDIT_ENTITY_TYPE,
      entityId: taskId,
      action: "update",
      actorId: userId,
      changes: {
        status: { old: PriorityTaskStatus.Delegated, new: PriorityTaskStatus.Accepted },
        ownerId: { old: previousOwnerId ?? null, new: userId },
        quadrant: dto.quadrant,
      },
    });

    const updated = await this.priorityTasksRepo.findOneScoped({ where: { id: taskId } });
    if (!updated) {
      throw new NotFoundException("Task not found");
    }
    return updated;
  }

  // Story 1.8 -- a pending recipient passes a delegated task on to someone
  // else instead of accepting it. Ownership does NOT change (still the
  // original delegator's); only delegatedToUserId/By move. The full
  // delegator -> me -> target chain lives in audit_logs history (Story 1.9).
  async redelegate(taskId: string, userId: string, dto: DelegatePriorityTaskDto): Promise<PriorityTask> {
    this.logger.debug(`redelegate called for task ${taskId} by ${userId} (userId=${dto.userId})`);
    if (dto.userId === userId) {
      throw new BadRequestException("You can't re-delegate a task to yourself");
    }
    const targetUser = await this.usersService.findOneOrFail(dto.userId);
    if (targetUser.status !== UserStatus.Active) {
      throw new BadRequestException("You can only delegate to active users");
    }

    const task = await this.priorityTasksRepo.findOneScoped({ where: { id: taskId } });
    if (!task || task.delegatedToUserId !== userId) {
      this.logger.debug(`Blocked: task ${taskId} is not pending acceptance by ${userId}`);
      throw new NotFoundException("Task not found");
    }
    try {
      task.delegatedToUserId = dto.userId;
      task.delegatedByUserId = userId;
      task.updatedBy = userId;
      await this.priorityTasksRepo.saveScoped(task);
      this.logger.debug(`redelegate succeeded for task ${taskId}`);
    } catch (err) {
      this.logger.error(`redelegate failed for task ${taskId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }

    await this.auditLogService.record({
      entityType: AUDIT_ENTITY_TYPE,
      entityId: taskId,
      action: "update",
      actorId: userId,
      changes: {
        delegatedToUserId: { old: userId, new: dto.userId },
        delegatedByUserId: { old: null, new: userId },
        delegatedToName: targetUser.displayName,
      },
    });

    const updated = await this.priorityTasksRepo.findOneScoped({ where: { id: taskId } });
    if (!updated) {
      throw new NotFoundException("Task not found");
    }
    return updated;
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
        // Story 1.8 -- the "delegated by" for the recipient's Incoming panel.
        // On a first delegation this is the owner themselves.
        task.delegatedByUserId = ownerId;
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
