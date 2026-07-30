import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, In, Repository } from "typeorm";
import {
  IncomingTaskResponse,
  PriorityTaskFlowEventType,
  PriorityTaskHistoryEntry,
  PriorityTaskQuadrant,
  PriorityTaskStatus,
  UserStatus,
} from "@orelia/common";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { PRIORITY_TASK_FLOW_CHANGED_EVENT, RealtimeService } from "../../core/realtime";
import { TenantContextService } from "../../core/tenant";
import { User } from "../users/entities/user.entity";
import { UsersService } from "../users/users.service";
import { AcceptPriorityTaskDto } from "./dto/accept-priority-task.dto";
import { CreatePriorityTaskDto } from "./dto/create-priority-task.dto";
import { DelegatePriorityTaskDto } from "./dto/delegate-priority-task.dto";
import { MovePriorityTaskDto } from "./dto/move-priority-task.dto";
import { UpdatePriorityTaskDto } from "./dto/update-priority-task.dto";
import { UpdatePriorityTaskProgressDto } from "./dto/update-priority-task-progress.dto";
import { PriorityTaskFlow } from "./entities/priority-task-flow.entity";
import { PriorityTaskShare } from "./entities/priority-task-share.entity";
import { PriorityTask } from "./entities/priority-task.entity";
import { PriorityTasksRepository } from "./priority-tasks.repository";

const AUDIT_ENTITY_TYPE = "priority_task";

// A task is "on the active board" while it's in one of these stages -- an
// Archived task has left the board (Story 1.10) even though it's still a
// "holder"-type row for ownership/access purposes (ALL_HOLDER_TYPES below).
const BOARD_TYPES = [
  PriorityTaskFlowEventType.Placed,
  PriorityTaskFlowEventType.Accepted,
  PriorityTaskFlowEventType.Completed,
];
// Every event type that means "I actually hold this task", as opposed to
// PriorityTaskFlowEventType.Delegated, which means "I handed it off and am
// tracking it" -- the two are mutually exclusive for a given (task, user) at
// any moment, enforced by the same is_current invariant that fixes the
// duplicate-tracker bug (see the entity's own comment).
const ALL_HOLDER_TYPES = [...BOARD_TYPES, PriorityTaskFlowEventType.Archived];

function eventTypeToStatus(eventType: PriorityTaskFlowEventType): PriorityTaskStatus {
  switch (eventType) {
    case PriorityTaskFlowEventType.Placed:
      return PriorityTaskStatus.Placed;
    case PriorityTaskFlowEventType.Delegated:
      return PriorityTaskStatus.Delegated;
    case PriorityTaskFlowEventType.Accepted:
      return PriorityTaskStatus.Accepted;
    case PriorityTaskFlowEventType.Completed:
      return PriorityTaskStatus.Completed;
    case PriorityTaskFlowEventType.Archived:
      return PriorityTaskStatus.Archived;
  }
}

// The shape every read method returns -- everything the controller's
// toResponse() needs, replacing what used to be plain columns on PriorityTask
// itself. `ownerId`/`status`/`delegatedToUserId` are the CANONICAL task-wide
// values (see resolveCanonicalView below), not necessarily "the viewer's
// own" -- e.g. a share recipient reading a task they don't own still sees
// the real owner here, same as the old ownerId column always did.
export interface PriorityTaskView {
  id: string;
  title: string;
  notes: string | null;
  createdAt: Date;
  createdBy?: string;
  quadrant: PriorityTaskQuadrant;
  rank: number;
  status: PriorityTaskStatus;
  progress: number;
  ownerId: string;
  delegatedToUserId: string | null;
}

export interface DelegationTrackerView {
  id: string;
  taskId: string;
  taskTitle: string;
  taskStatus: PriorityTaskStatus;
  taskProgress: number;
  delegatedToUserId: string;
  rank: number;
  createdAt: Date;
}

@Injectable()
export class PriorityTasksService {
  private readonly logger = new Logger(PriorityTasksService.name);

  constructor(
    private readonly priorityTasksRepo: PriorityTasksRepository,
    private readonly auditLogService: AuditLogService,
    private readonly realtimeService: RealtimeService,
    private readonly tenantContext: TenantContextService,
    private readonly usersService: UsersService,
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(PriorityTaskShare) private readonly sharesRepo: Repository<PriorityTaskShare>,
    @InjectRepository(PriorityTaskFlow) private readonly flowRepo: Repository<PriorityTaskFlow>,
  ) {}

  // ---------------------------------------------------------------------
  // View-building helpers -- every read/write method below funnels through
  // these two so "how a task's canonical state is derived from flow rows"
  // lives in exactly one place.
  // ---------------------------------------------------------------------

  // Builds a view directly from a row the viewer themselves holds -- used
  // whenever the caller already knows the viewer IS the row's own user_id
  // (findOneOwnedOrFail, findAllForUser), so no cross-user resolution is
  // needed.
  private rowToView(task: PriorityTask, row: PriorityTaskFlow): PriorityTaskView {
    return {
      id: task.id,
      title: task.title,
      notes: task.notes ?? null,
      createdAt: task.createdAt,
      createdBy: task.createdBy,
      quadrant: row.quadrant as PriorityTaskQuadrant,
      rank: row.rank as number,
      status: eventTypeToStatus(row.eventType),
      progress: row.progress,
      ownerId: row.userId,
      delegatedToUserId: row.eventType === PriorityTaskFlowEventType.Delegated ? (row.linkedUserId ?? null) : null,
    };
  }

  // The canonical, viewer-independent view of a task: whoever currently
  // HOLDS it (placed/accepted/completed/archived) if anyone does, else
  // whoever most recently DELEGATED it while it's still pending. This is
  // exactly what the old single ownerId/status/delegatedToUserId columns on
  // priority_tasks represented -- one evolving pointer, now derived instead
  // of stored.
  private resolveCanonicalView(task: PriorityTask, currentRows: PriorityTaskFlow[]): PriorityTaskView {
    const holder = currentRows.find((row) => BOARD_TYPES.includes(row.eventType) || row.eventType === PriorityTaskFlowEventType.Archived);
    if (holder) {
      return this.rowToView(task, holder);
    }
    const delegated = currentRows
      .filter((row) => row.eventType === PriorityTaskFlowEventType.Delegated)
      .sort((a, b) => b.seq - a.seq)[0];
    if (delegated) {
      return this.rowToView(task, delegated);
    }
    throw new Error(`Task ${task.id} has no live priority_task_flow state`);
  }

  private async currentRowsForTask(taskId: string, manager?: EntityManager): Promise<PriorityTaskFlow[]> {
    const repo = manager ? manager.getRepository(PriorityTaskFlow) : this.flowRepo;
    return repo.find({ where: { taskId, isCurrent: true } });
  }

  // Epic 3, Story 3.4 -- pushes "this task changed" to everyone with a live
  // stake in it right now: every current row's own user_id, plus whoever a
  // `delegated` row's linked_user_id points at (the pending recipient, who
  // holds no row of their own yet -- see the flow entity's own comment).
  // `extraUserIds` covers the one case that misses: redelegate() leaves the
  // re-delegator with no row and no longer the linked target either, so they
  // have to be named explicitly or they'd never learn it left their Incoming.
  // Fire-and-forget: a delivery failure here must never fail the real
  // mutation it's reporting on, same principle as AuditLogService.record.
  private async broadcastFlowChanged(taskId: string, extraUserIds: string[] = []): Promise<void> {
    try {
      const rows = await this.currentRowsForTask(taskId);
      const userIds = new Set<string>(extraUserIds);
      for (const row of rows) {
        userIds.add(row.userId);
        if (row.linkedUserId) userIds.add(row.linkedUserId);
      }
      this.realtimeService.emitToUsers(this.tenantContext.getTenantId(), [...userIds], PRIORITY_TASK_FLOW_CHANGED_EVENT, {
        taskId,
      });
    } catch (err) {
      this.logger.error(`broadcastFlowChanged failed for task ${taskId}: ${(err as Error).message}`, (err as Error).stack);
    }
  }

  // Ungated fetch for a method's own return value, for an actor who just
  // legitimately mutated the task but may no longer hold any relationship
  // to it afterward -- redelegate() is exactly this: passing a pending
  // delegation on leaves the re-delegator with nothing (no holder row, no
  // tracker, no longer the pending target), same as the old code's final
  // `findOneScoped` (no access check) at the end of delegate/redelegate/
  // accept. Never use this for a fresh read request -- only for handing
  // back the result of an action the caller just proved they were allowed
  // to take.
  private async canonicalView(taskId: string): Promise<PriorityTaskView> {
    const task = await this.priorityTasksRepo.findOneScoped({ where: { id: taskId } });
    if (!task) throw new NotFoundException("Task not found");
    const currentRows = await this.currentRowsForTask(taskId);
    return this.resolveCanonicalView(task, currentRows);
  }

  private async nextSeq(taskId: string, manager: EntityManager): Promise<number> {
    const result = await manager
      .getRepository(PriorityTaskFlow)
      .createQueryBuilder("flow")
      .select("MAX(flow.seq)", "max")
      .where("flow.taskId = :taskId", { taskId })
      .getRawOne<{ max: number | null }>();
    return (result?.max ?? 0) + 1;
  }

  private async nextRank(
    userId: string,
    quadrant: PriorityTaskQuadrant,
    eventTypes: PriorityTaskFlowEventType[],
    manager: EntityManager,
    lock: { mode: "pessimistic_write" },
  ): Promise<number> {
    const [last] = await manager.getRepository(PriorityTaskFlow).find({
      where: { userId, quadrant, isCurrent: true, eventType: In(eventTypes) },
      order: { rank: "DESC" },
      take: 1,
      lock,
    });
    return (last?.rank ?? 0) + 1;
  }

  // Finds the viewer's own current row for a task (if any) and closes it
  // out (is_current=false) inside the caller's transaction. This is THE fix
  // for the duplicate-tracker bug: every write path that gives a user a new
  // row for a task calls this first, so a task cycling back to someone who
  // held/tracked it before can never leave two is_current rows behind for
  // them -- the database's own partial unique index (Story 3.1) would
  // refuse it anyway; this is what makes sure that never gets exercised as
  // an error path.
  private async closeCurrentRow(
    taskId: string,
    userId: string,
    manager: EntityManager,
    lock: { mode: "pessimistic_write" },
  ): Promise<PriorityTaskFlow | undefined> {
    const repo = manager.getRepository(PriorityTaskFlow);
    const [row] = await repo.find({ where: { taskId, userId, isCurrent: true }, take: 1, lock });
    if (row) {
      row.isCurrent = false;
      await repo.save(row);
    }
    return row;
  }

  private async resequence(
    rows: PriorityTaskFlow[],
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(PriorityTaskFlow);
    for (const [index, row] of rows.entries()) {
      row.rank = index + 1;
      await repo.save(row);
    }
  }

  // ---------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------

  async findAllForUser(userId: string): Promise<PriorityTaskView[]> {
    this.logger.debug(`findAllForUser called (userId=${userId})`);
    try {
      const rows = await this.flowRepo.find({
        where: { userId, isCurrent: true, eventType: In(BOARD_TYPES) },
        order: { rank: "ASC" },
      });
      const results = await this.attachTasks(rows);
      this.logger.debug(`findAllForUser returning ${results.length} row(s)`);
      return results;
    } catch (err) {
      this.logger.error(`findAllForUser failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async findArchivedForUser(userId: string): Promise<PriorityTaskView[]> {
    this.logger.debug(`findArchivedForUser called (userId=${userId})`);
    try {
      const rows = await this.flowRepo.find({
        where: { userId, isCurrent: true, eventType: PriorityTaskFlowEventType.Archived },
        order: { createdAt: "DESC" },
      });
      const results = await this.attachTasks(rows);
      this.logger.debug(`findArchivedForUser returning ${results.length} row(s)`);
      return results;
    } catch (err) {
      this.logger.error(`findArchivedForUser failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Batches the task lookup for a list of flow rows into one query rather
  // than N -- same "one grouped query" discipline the controller already
  // applies to share counts (Story 2.3).
  private async attachTasks(rows: PriorityTaskFlow[]): Promise<PriorityTaskView[]> {
    if (rows.length === 0) return [];
    const taskIds = [...new Set(rows.map((row) => row.taskId))];
    const tasks = await this.priorityTasksRepo.findScoped({ where: { id: In(taskIds) } });
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const results: PriorityTaskView[] = [];
    for (const row of rows) {
      const task = taskById.get(row.taskId);
      if (!task) {
        // Defensive only -- task_id is ON DELETE CASCADE and remove() forces
        // is_current=false on every row of a soft-deleted task, so this
        // shouldn't be reachable. Skipped rather than 500ing the whole list.
        this.logger.debug(`Skipping flow row ${row.id}: task ${row.taskId} no longer resolves`);
        continue;
      }
      results.push(this.rowToView(task, row));
    }
    return results;
  }

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

  // The board card's "who moved it where" preview -- sourced from
  // priority_task_flow, not audit_logs, since flow already IS a per-hop
  // (user, quadrant) record in order; no audit-log parsing needed. Only
  // placed/accepted/delegated hops count as a "move" -- completed/archived
  // rows just carry the prior quadrant forward unchanged (see complete()/
  // archive() above), so including them would render misleading duplicate-
  // looking hops like "Ben(Do) -> Ben(Do)" for marking your own task done.
  async getRecentFlowHopsByTaskIds(
    taskIds: string[],
    limit = 3,
  ): Promise<Map<string, { userId: string; userName: string; quadrant: PriorityTaskQuadrant; timestamp: string }[]>> {
    this.logger.debug(`getRecentFlowHopsByTaskIds called (${taskIds.length} task id(s))`);
    if (taskIds.length === 0) {
      this.logger.debug("No task ids supplied, skipping the query and returning an empty map");
      return new Map();
    }
    try {
      const rows: { task_id: string; user_id: string; quadrant: PriorityTaskQuadrant; created_at: Date }[] =
        await this.flowRepo.query(
          `SELECT task_id, user_id, quadrant, created_at
             FROM (
               SELECT task_id, user_id, quadrant, created_at,
                      ROW_NUMBER() OVER (PARTITION BY task_id ORDER BY seq DESC) AS rn
                 FROM priority_task_flow
                WHERE task_id = ANY($1::uuid[])
                  AND event_type IN ('placed', 'accepted', 'delegated')
             ) ranked
            WHERE rn <= $2
            ORDER BY task_id, created_at DESC`,
          [taskIds, limit],
        );
      const userIds = [...new Set(rows.map((row) => row.user_id))];
      const names = new Map(
        await Promise.all(
          userIds.map(async (id) => [id, (await this.getUserDisplayName(id)) ?? ""] as const),
        ),
      );
      const byTask = new Map<
        string,
        { userId: string; userName: string; quadrant: PriorityTaskQuadrant; timestamp: string }[]
      >();
      for (const row of rows) {
        const list = byTask.get(row.task_id) ?? [];
        list.push({
          userId: row.user_id,
          userName: names.get(row.user_id) ?? "",
          quadrant: row.quadrant,
          timestamp: row.created_at.toISOString(),
        });
        byTask.set(row.task_id, list);
      }
      this.logger.debug(`getRecentFlowHopsByTaskIds returning hops for ${byTask.size} of ${taskIds.length} task(s)`);
      return byTask;
    } catch (err) {
      this.logger.error(`getRecentFlowHopsByTaskIds failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

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

  // Readable by: whoever holds it, a share recipient, whoever is tracking a
  // delegation of it (Story 2.4), or the pending recipient of an
  // not-yet-accepted delegation (Story 2.9). Returns the CANONICAL view
  // (resolveCanonicalView), same as the old single shared task row always
  // did -- the viewer's own relationship to it only gates access, it
  // doesn't change what's returned.
  async findOneForUser(taskId: string, userId: string): Promise<PriorityTaskView> {
    this.logger.debug(`findOneForUser called (taskId=${taskId}, userId=${userId})`);
    const task = await this.priorityTasksRepo.findOneScoped({ where: { id: taskId } });
    if (!task) {
      this.logger.debug(`Blocked: task ${taskId} not found`);
      throw new NotFoundException("Task not found");
    }

    const currentRows = await this.currentRowsForTask(taskId);

    const holds = currentRows.some((row) => row.userId === userId && ALL_HOLDER_TYPES.includes(row.eventType));
    if (holds) return this.resolveCanonicalView(task, currentRows);

    const sharedWithCaller = await this.sharesRepo.exists({ where: { taskId, sharedWithUserId: userId } });
    if (sharedWithCaller) {
      this.logger.debug(`Read access to task ${taskId} granted to ${userId} via share`);
      return this.resolveCanonicalView(task, currentRows);
    }

    const tracksCaller = currentRows.some(
      (row) => row.userId === userId && row.eventType === PriorityTaskFlowEventType.Delegated,
    );
    if (tracksCaller) {
      this.logger.debug(`Read access to task ${taskId} granted to ${userId} via delegation tracker`);
      return this.resolveCanonicalView(task, currentRows);
    }

    const isPendingDelegate = currentRows.some(
      (row) => row.eventType === PriorityTaskFlowEventType.Delegated && row.linkedUserId === userId,
    );
    if (isPendingDelegate) {
      this.logger.debug(`Read access to task ${taskId} granted to ${userId} as the pending delegate`);
      return this.resolveCanonicalView(task, currentRows);
    }

    this.logger.debug(
      `Blocked: task ${taskId} not owned by, shared with, delegated by, or delegated to ${userId}`,
    );
    throw new NotFoundException("Task not found");
  }

  // Epic 3, Story 3.5 -- every distinct user findOneForUser would grant read
  // access to, as a flat list: current holder(s)/tracker-holder(s), any
  // pending delegate, and every share recipient. Used to fan a new chat
  // message out to exactly the people who could actually open that thread --
  // not a broadcast to the whole tenant, and not re-deriving the access rule
  // a second time in a different shape.
  async getAccessibleUserIds(taskId: string): Promise<string[]> {
    const currentRows = await this.currentRowsForTask(taskId);
    const userIds = new Set<string>();
    for (const row of currentRows) {
      userIds.add(row.userId);
      if (row.linkedUserId) userIds.add(row.linkedUserId);
    }
    const shares = await this.sharesRepo.find({ where: { taskId } });
    for (const share of shares) {
      userIds.add(share.sharedWithUserId);
    }
    return [...userIds];
  }

  // Owner-only variant -- every mutation needs this, never findOneForUser.
  // "Owned" = the viewer holds an ALL_HOLDER_TYPES row (includes Archived,
  // since restore() and remove() both act on an archived task the caller
  // still holds).
  async findOneOwnedOrFail(taskId: string, userId: string): Promise<PriorityTaskView> {
    const task = await this.priorityTasksRepo.findOneScoped({ where: { id: taskId } });
    if (!task) {
      this.logger.debug(`Blocked: task ${taskId} not found`);
      throw new NotFoundException("Task not found");
    }
    const row = await this.flowRepo.findOne({
      where: { taskId, userId, isCurrent: true, eventType: In(ALL_HOLDER_TYPES) },
    });
    if (!row) {
      this.logger.debug(`Blocked: task ${taskId} not found or not owned by ${userId}`);
      throw new NotFoundException("Task not found");
    }
    return this.rowToView(task, row);
  }

  async findDelegationTrackersForUser(userId: string): Promise<DelegationTrackerView[]> {
    this.logger.debug(`findDelegationTrackersForUser called (userId=${userId})`);
    try {
      const rows = await this.flowRepo.find({
        where: { userId, isCurrent: true, eventType: PriorityTaskFlowEventType.Delegated },
        order: { rank: "ASC" },
      });
      if (rows.length === 0) return [];

      const taskIds = [...new Set(rows.map((row) => row.taskId))];
      const tasks = await this.priorityTasksRepo.findScoped({ where: { id: In(taskIds) } });
      const taskById = new Map(tasks.map((task) => [task.id, task]));

      const results: DelegationTrackerView[] = [];
      for (const row of rows) {
        const task = taskById.get(row.taskId);
        if (!task) {
          this.logger.debug(`Skipped tracker ${row.id}: task ${row.taskId} no longer resolves`);
          continue;
        }
        // Live-joined, never a frozen snapshot (Story 2.4): find whoever
        // actually holds the task right now, if anyone has accepted it yet.
        const currentRows = await this.currentRowsForTask(row.taskId);
        const holder = currentRows.find((r) => BOARD_TYPES.includes(r.eventType) || r.eventType === PriorityTaskFlowEventType.Archived);
        results.push({
          id: row.id,
          taskId: row.taskId,
          taskTitle: task.title,
          taskStatus: holder ? eventTypeToStatus(holder.eventType) : PriorityTaskStatus.Delegated,
          taskProgress: holder ? holder.progress : row.progress,
          delegatedToUserId: holder ? holder.userId : (row.linkedUserId ?? row.userId),
          rank: row.rank as number,
          createdAt: row.createdAt,
        });
      }
      this.logger.debug(`findDelegationTrackersForUser returning ${results.length} row(s)`);
      return results;
    } catch (err) {
      this.logger.error(`findDelegationTrackersForUser failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async getUserDisplayName(userId: string | undefined): Promise<string | null> {
    if (!userId) return null;
    const user = await this.usersRepo.findOne({
      where: { id: userId, tenantId: this.tenantContext.getTenantId() },
    });
    return user?.displayName ?? null;
  }

  async updateNotes(taskId: string, userId: string, dto: UpdatePriorityTaskDto): Promise<PriorityTaskView> {
    this.logger.debug(`updateNotes called for task ${taskId} by ${userId}`);
    try {
      await this.findOneOwnedOrFail(taskId, userId);
      const task = await this.priorityTasksRepo.findOneScoped({ where: { id: taskId } });
      if (!task) throw new NotFoundException("Task not found");
      task.notes = dto.notes;
      task.updatedBy = userId;
      await this.priorityTasksRepo.saveScoped(task);
      this.logger.debug(`updateNotes succeeded for task ${taskId}`);
      return await this.findOneOwnedOrFail(taskId, userId);
    } catch (err) {
      this.logger.error(`updateNotes failed for task ${taskId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Unchanged (Story 3.2 note): still reads from audit_logs, not from
  // priority_task_flow. Flow only records ownership/lifecycle hops, not
  // every progress tick or re-delegation hand-off, so it can't stand in as
  // the sole history source without losing entries this endpoint's existing
  // ACs require.
  async getHistory(taskId: string, userId: string): Promise<PriorityTaskHistoryEntry[]> {
    this.logger.debug(`getHistory called for task ${taskId} by ${userId}`);
    await this.findOneForUser(taskId, userId); // access check (throws 404 if none)
    const rows = await this.auditLogService.findForEntity(AUDIT_ENTITY_TYPE, taskId);
    const entries: PriorityTaskHistoryEntry[] = [];
    for (const row of rows) {
      const mapped = this.mapAuditRow(row.action, (row.changes ?? {}) as Record<string, unknown>);
      if (!mapped) continue;
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
    // accept()'s own auditLogService.record() call already writes the
    // acceptor's chosen quadrant into changes.quadrant -- this just stops
    // dropping it on the floor. Historical rows recorded before this line
    // existed have no changes.quadrant, so detail falls back to null and the
    // frontend renders the old plain "Accepted" string for those.
    const acceptedQuadrant = typeof changes.quadrant === "string" ? changes.quadrant : null;

    if (statusChange?.new === PriorityTaskStatus.Delegated) return { kind: "delegated", detail: delegatedToName };
    if (statusChange?.new === PriorityTaskStatus.Accepted) return { kind: "accepted", detail: acceptedQuadrant };
    if (statusChange?.new === PriorityTaskStatus.Completed) return { kind: "completed", detail: null };
    if (statusChange?.new === PriorityTaskStatus.Archived) return { kind: "archived", detail: null };
    if (statusChange?.old === PriorityTaskStatus.Archived && statusChange?.new === PriorityTaskStatus.Placed) {
      return { kind: "restored", detail: null };
    }
    if ("delegatedToUserId" in changes && !statusChange) return { kind: "redelegated", detail: delegatedToName };
    const progressChange = changes.progress as { new?: number } | undefined;
    if (progressChange && typeof progressChange.new === "number") {
      return { kind: "progress", detail: String(progressChange.new) };
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // Writes
  // ---------------------------------------------------------------------

  // Story 2.10 -- permanently clear an archived task. SOFT delete on
  // priority_tasks (deletedAt/deletedBy + an audit row), same as before.
  // The flow-model equivalent of "cascade to trackers/shares": force
  // is_current=false on every flow row for this task (never hard-deleted --
  // flow rows are never removed, only superseded, so the full history stays
  // queryable for as long as the task row itself survives) and hard-remove
  // the share rows, matching the old join-table exemption.
  async remove(taskId: string, userId: string): Promise<void> {
    this.logger.debug(`remove called for task ${taskId} by ${userId}`);
    const view = await this.findOneOwnedOrFail(taskId, userId);
    if (view.status !== PriorityTaskStatus.Archived) {
      this.logger.debug(`Blocked: task ${taskId} is ${view.status}, only an archived task can be deleted`);
      throw new ConflictException("Only an archived task can be deleted");
    }

    let closedFlowRows = 0;
    let removedShares = 0;
    try {
      await this.dataSource.transaction(async (manager) => {
        const taskRepo = manager.getRepository(PriorityTask);
        const flowRepo = manager.getRepository(PriorityTaskFlow);
        const shareRepo = manager.getRepository(PriorityTaskShare);

        const openRows = await flowRepo.find({ where: { taskId, isCurrent: true } });
        if (openRows.length > 0) {
          this.logger.debug(`Closing ${openRows.length} open flow row(s) for deleted task ${taskId}`);
          for (const row of openRows) {
            row.isCurrent = false;
          }
          await flowRepo.save(openRows);
          closedFlowRows = openRows.length;
        }

        const shares = await shareRepo.find({ where: { taskId } });
        if (shares.length > 0) {
          this.logger.debug(`Cascading hard-delete to ${shares.length} share row(s)`);
          await shareRepo.remove(shares);
          removedShares = shares.length;
        }

        const task = await taskRepo.findOneOrFail({ where: { id: taskId } });
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
        title: view.title,
        quadrant: view.quadrant,
        status: view.status,
        progress: view.progress,
        closedFlowRows,
        removedShares,
      },
    });
  }

  async archive(taskId: string, userId: string): Promise<PriorityTaskView> {
    this.logger.debug(`archive called for task ${taskId} by ${userId}`);
    try {
      const task = await this.priorityTasksRepo.findOneScoped({ where: { id: taskId } });
      if (!task) throw new NotFoundException("Task not found");

      let previousStatus: PriorityTaskStatus | undefined;
      await this.dataSource.transaction(async (manager) => {
        const lock = { mode: "pessimistic_write" as const };
        const flowRepo = manager.getRepository(PriorityTaskFlow);
        const [row] = await flowRepo.find({
          where: { taskId, userId, isCurrent: true, eventType: In(ALL_HOLDER_TYPES) },
          take: 1,
          lock,
        });
        if (!row) throw new NotFoundException("Task not found");
        if (row.eventType !== PriorityTaskFlowEventType.Completed) {
          this.logger.debug(`Blocked: task ${taskId} is ${eventTypeToStatus(row.eventType)}, only a completed task can be archived`);
          throw new BadRequestException("Only a completed task can be archived");
        }
        previousStatus = eventTypeToStatus(row.eventType);
        row.isCurrent = false;
        await flowRepo.save(row);
        const seq = await this.nextSeq(taskId, manager);
        await flowRepo.save(
          flowRepo.create({
            taskId,
            userId,
            seq,
            eventType: PriorityTaskFlowEventType.Archived,
            quadrant: row.quadrant,
            rank: row.rank,
            progress: row.progress,
            isCurrent: true,
            createdBy: userId,
          }),
        );
      });
      this.logger.debug(`archive succeeded for task ${taskId}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: taskId,
        action: "update",
        actorId: userId,
        changes: { status: { old: previousStatus ?? null, new: PriorityTaskStatus.Archived } },
      });
      await this.broadcastFlowChanged(taskId);
      return await this.findOneOwnedOrFail(taskId, userId);
    } catch (err) {
      if (!(err instanceof NotFoundException) && !(err instanceof BadRequestException)) {
        this.logger.error(`archive failed for task ${taskId}: ${(err as Error).message}`, (err as Error).stack);
      }
      throw err;
    }
  }

  async restore(taskId: string, userId: string): Promise<PriorityTaskView> {
    this.logger.debug(`restore called for task ${taskId} by ${userId}`);
    try {
      await this.dataSource.transaction(async (manager) => {
        const lock = { mode: "pessimistic_write" as const };
        const flowRepo = manager.getRepository(PriorityTaskFlow);
        const [row] = await flowRepo.find({
          where: { taskId, userId, isCurrent: true, eventType: In(ALL_HOLDER_TYPES) },
          take: 1,
          lock,
        });
        if (!row) throw new NotFoundException("Task not found");
        if (row.eventType !== PriorityTaskFlowEventType.Archived) {
          throw new BadRequestException("Only an archived task can be restored");
        }
        const quadrant = row.quadrant as PriorityTaskQuadrant;
        row.isCurrent = false;
        await flowRepo.save(row);
        const rank = await this.nextRank(userId, quadrant, BOARD_TYPES, manager, lock);
        const seq = await this.nextSeq(taskId, manager);
        await flowRepo.save(
          flowRepo.create({
            taskId,
            userId,
            seq,
            eventType: PriorityTaskFlowEventType.Placed,
            quadrant,
            rank,
            progress: row.progress,
            isCurrent: true,
            createdBy: userId,
          }),
        );
      });
      this.logger.debug(`restore succeeded for task ${taskId}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: taskId,
        action: "update",
        actorId: userId,
        changes: { status: { old: PriorityTaskStatus.Archived, new: PriorityTaskStatus.Placed } },
      });
      await this.broadcastFlowChanged(taskId);
      return await this.findOneOwnedOrFail(taskId, userId);
    } catch (err) {
      if (!(err instanceof NotFoundException) && !(err instanceof BadRequestException)) {
        this.logger.error(`restore failed for task ${taskId}: ${(err as Error).message}`, (err as Error).stack);
      }
      throw err;
    }
  }

  async complete(taskId: string, userId: string): Promise<PriorityTaskView> {
    this.logger.debug(`complete called for task ${taskId} by ${userId}`);
    try {
      let previousStatus: PriorityTaskStatus | undefined;
      await this.dataSource.transaction(async (manager) => {
        const lock = { mode: "pessimistic_write" as const };
        const flowRepo = manager.getRepository(PriorityTaskFlow);
        const [row] = await flowRepo.find({
          where: { taskId, userId, isCurrent: true, eventType: In(ALL_HOLDER_TYPES) },
          take: 1,
          lock,
        });
        if (!row) throw new NotFoundException("Task not found");
        previousStatus = eventTypeToStatus(row.eventType);
        row.isCurrent = false;
        await flowRepo.save(row);
        const seq = await this.nextSeq(taskId, manager);
        await flowRepo.save(
          flowRepo.create({
            taskId,
            userId,
            seq,
            eventType: PriorityTaskFlowEventType.Completed,
            quadrant: row.quadrant,
            rank: row.rank,
            progress: row.progress,
            isCurrent: true,
            createdBy: userId,
          }),
        );
      });
      this.logger.debug(`complete succeeded for task ${taskId}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: taskId,
        action: "update",
        actorId: userId,
        changes: { status: { old: previousStatus, new: PriorityTaskStatus.Completed } },
      });
      await this.broadcastFlowChanged(taskId);
      return await this.findOneOwnedOrFail(taskId, userId);
    } catch (err) {
      if (!(err instanceof NotFoundException)) {
        this.logger.error(`complete failed for task ${taskId}: ${(err as Error).message}`, (err as Error).stack);
      }
      throw err;
    }
  }

  // Story 1.8 -- everything shared with OR delegated to the caller. A
  // pending delegation TO me is found via linked_user_id on someone else's
  // current `delegated` row -- there is no separate row for me as the
  // pending recipient (see the entity's own comment).
  async findIncomingForUser(userId: string): Promise<IncomingTaskResponse[]> {
    this.logger.debug(`findIncomingForUser called (userId=${userId})`);
    try {
      const pendingRows = await this.flowRepo.find({
        where: { linkedUserId: userId, isCurrent: true, eventType: PriorityTaskFlowEventType.Delegated },
        order: { createdAt: "DESC" },
      });
      const shares = await this.sharesRepo.find({
        where: { sharedWithUserId: userId },
        relations: ["task"],
        order: { createdAt: "DESC" },
      });

      const items: IncomingTaskResponse[] = [];
      if (pendingRows.length > 0) {
        const taskIds = [...new Set(pendingRows.map((row) => row.taskId))];
        const tasks = await this.priorityTasksRepo.findScoped({ where: { id: In(taskIds) } });
        const taskById = new Map(tasks.map((task) => [task.id, task]));
        for (const row of pendingRows) {
          const task = taskById.get(row.taskId);
          if (!task) continue;
          items.push({
            id: task.id,
            title: task.title,
            kind: "delegated",
            // The row's own user_id is who created THIS delegation hop.
            // Deliberate simplification: on a re-delegation chain (a still-
            // pending recipient passes it on again, Story 1.8), this shows
            // the ORIGINAL delegator rather than whoever most recently
            // re-delegated it -- redelegate() mutates linked_user_id on the
            // same row in place (see that method), and this row carries no
            // separate "last re-delegator" field. Narrow, only visible on a
            // 2+-hop pre-acceptance chain.
            fromName: (await this.getUserDisplayName(row.userId)) ?? "",
            status: PriorityTaskStatus.Delegated,
            progress: row.progress,
            createdAt: row.createdAt.toISOString(),
            notes: task.notes ?? null,
          });
        }
      }
      for (const share of shares) {
        if (!share.task) continue;
        items.push({
          id: share.task.id,
          title: share.task.title,
          kind: "shared",
          fromName: (await this.getUserDisplayName(share.createdBy)) ?? "",
          status: PriorityTaskStatus.Placed, // presentational only for shares -- the UI never reads status off a "shared" item
          progress: 0,
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

  // Story 1.8 -- accept a task delegated to me. The delegator's own
  // `delegated` row is left untouched (is_current stays true) -- that IS
  // their tracking card, live-joined to whatever I do next. If I hold a
  // stale row of my own from an earlier point in this task's history (the
  // exact bug this epic exists to fix), closeCurrentRow retires it in the
  // same transaction as my new row is created.
  async accept(taskId: string, userId: string, dto: AcceptPriorityTaskDto): Promise<PriorityTaskView> {
    this.logger.debug(`accept called for task ${taskId} by ${userId} (quadrant=${dto.quadrant})`);
    let previousOwnerId: string | undefined;
    try {
      await this.dataSource.transaction(async (manager) => {
        const lock = { mode: "pessimistic_write" as const };
        const flowRepo = manager.getRepository(PriorityTaskFlow);
        const [pending] = await flowRepo.find({
          where: { taskId, linkedUserId: userId, isCurrent: true, eventType: PriorityTaskFlowEventType.Delegated },
          take: 1,
          lock,
        });
        if (!pending) {
          this.logger.debug(`Blocked: task ${taskId} is not pending acceptance by ${userId}`);
          throw new NotFoundException("Task not found");
        }
        previousOwnerId = pending.userId;

        await this.closeCurrentRow(taskId, userId, manager, lock);

        const rank = await this.nextRank(userId, dto.quadrant, BOARD_TYPES, manager, lock);
        const seq = await this.nextSeq(taskId, manager);
        await flowRepo.save(
          flowRepo.create({
            taskId,
            userId,
            seq,
            eventType: PriorityTaskFlowEventType.Accepted,
            linkedUserId: pending.userId,
            quadrant: dto.quadrant,
            rank,
            progress: pending.progress,
            isCurrent: true,
            createdBy: userId,
          }),
        );
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

    await this.broadcastFlowChanged(taskId);
    return await this.findOneOwnedOrFail(taskId, userId);
  }

  // Story 1.8 -- pass a delegated-to-me task on to someone else without
  // accepting. No new hop, no new tracker: the original delegator's row
  // just points at a new target (see the flow event type's own comment on
  // why there's no separate "redelegated" row).
  async redelegate(taskId: string, userId: string, dto: DelegatePriorityTaskDto): Promise<PriorityTaskView> {
    this.logger.debug(`redelegate called for task ${taskId} by ${userId} (userId=${dto.userId})`);
    if (dto.userId === userId) {
      throw new BadRequestException("You can't re-delegate a task to yourself");
    }
    const targetUser = await this.usersService.findOneOrFail(dto.userId);
    if (targetUser.status !== UserStatus.Active) {
      throw new BadRequestException("You can only delegate to active users");
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        const lock = { mode: "pessimistic_write" as const };
        const flowRepo = manager.getRepository(PriorityTaskFlow);
        const [pending] = await flowRepo.find({
          where: { taskId, linkedUserId: userId, isCurrent: true, eventType: PriorityTaskFlowEventType.Delegated },
          take: 1,
          lock,
        });
        if (!pending) {
          this.logger.debug(`Blocked: task ${taskId} is not pending acceptance by ${userId}`);
          throw new NotFoundException("Task not found");
        }
        pending.linkedUserId = dto.userId;
        await flowRepo.save(pending);
      });
      this.logger.debug(`redelegate succeeded for task ${taskId}`);
    } catch (err) {
      if (!(err instanceof NotFoundException)) {
        this.logger.error(`redelegate failed for task ${taskId}: ${(err as Error).message}`, (err as Error).stack);
      }
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

    // userId (the re-delegator) is named explicitly: they hold no row of
    // their own and are no longer the linked target either the instant this
    // lands, so broadcastFlowChanged's generic "current rows' users" derivation
    // would otherwise never tell them it just left their own Incoming panel.
    await this.broadcastFlowChanged(taskId, [userId]);
    return await this.canonicalView(taskId);
  }

  async updateProgress(taskId: string, userId: string, dto: UpdatePriorityTaskProgressDto): Promise<PriorityTaskView> {
    this.logger.debug(`updateProgress called for task ${taskId} by ${userId} (progress=${dto.progress})`);
    try {
      const row = await this.flowRepo.findOne({
        where: { taskId, userId, isCurrent: true, eventType: In(ALL_HOLDER_TYPES) },
      });
      if (!row) throw new NotFoundException("Task not found");
      const previousProgress = row.progress;
      if (previousProgress === dto.progress) {
        this.logger.debug(`updateProgress: task ${taskId} already at ${dto.progress}%, no change`);
        return await this.findOneOwnedOrFail(taskId, userId);
      }
      row.progress = dto.progress;
      await this.flowRepo.save(row);
      this.logger.debug(`updateProgress succeeded for task ${taskId} (${previousProgress}% -> ${dto.progress}%)`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: taskId,
        action: "update",
        actorId: userId,
        changes: { progress: { old: previousProgress, new: dto.progress } },
      });
      return await this.findOneOwnedOrFail(taskId, userId);
    } catch (err) {
      if (!(err instanceof NotFoundException)) {
        this.logger.error(`updateProgress failed for task ${taskId}: ${(err as Error).message}`, (err as Error).stack);
      }
      throw err;
    }
  }

  // Story 1.6 (send-side only). Closes the delegator's current holder row
  // and opens a `delegated` tracking row in their own DELEGATE quadrant --
  // this is the write half of the fix: closeCurrentRow guarantees whatever
  // row the delegator held a moment ago can never linger as a second
  // is_current row once this one lands.
  async delegate(taskId: string, ownerId: string, dto: DelegatePriorityTaskDto): Promise<PriorityTaskView> {
    this.logger.debug(`delegate called for task ${taskId} by ${ownerId} (userId=${dto.userId})`);
    if (dto.userId === ownerId) {
      this.logger.debug(`Blocked: cannot delegate task ${taskId} to self`);
      throw new BadRequestException("You can't delegate a task to yourself");
    }

    const targetUser = await this.usersService.findOneOrFail(dto.userId);
    if (targetUser.status !== UserStatus.Active) {
      this.logger.debug(`Blocked: cannot delegate task ${taskId} to non-active user ${dto.userId}`);
      throw new BadRequestException("You can only delegate to active users");
    }

    let previousStatus: PriorityTaskStatus | undefined;
    try {
      await this.dataSource.transaction(async (manager) => {
        const lock = { mode: "pessimistic_write" as const };
        const flowRepo = manager.getRepository(PriorityTaskFlow);
        // Board-only (Placed/Accepted), not Completed/Archived -- a task
        // that's already done isn't a candidate to hand off. Slightly
        // tighter than the old code (which had no such guard), and matches
        // what the UI actually offers a Delegate action on.
        const [row] = await flowRepo.find({
          where: { taskId, userId: ownerId, isCurrent: true, eventType: In([PriorityTaskFlowEventType.Placed, PriorityTaskFlowEventType.Accepted]) },
          take: 1,
          lock,
        });
        if (!row) {
          throw new NotFoundException("Task not found");
        }

        previousStatus = eventTypeToStatus(row.eventType);
        row.isCurrent = false;
        await flowRepo.save(row);

        const trackerRank = await this.nextRank(ownerId, PriorityTaskQuadrant.Delegate, [PriorityTaskFlowEventType.Delegated], manager, lock);
        const seq = await this.nextSeq(taskId, manager);
        await flowRepo.save(
          flowRepo.create({
            taskId,
            userId: ownerId,
            seq,
            eventType: PriorityTaskFlowEventType.Delegated,
            linkedUserId: dto.userId,
            quadrant: PriorityTaskQuadrant.Delegate,
            rank: trackerRank,
            progress: row.progress,
            isCurrent: true,
            createdBy: ownerId,
          }),
        );
      });
      this.logger.debug(`delegate succeeded for task ${taskId}`);
    } catch (err) {
      if (!(err instanceof NotFoundException)) {
        this.logger.error(`delegate failed for task ${taskId}: ${(err as Error).message}`, (err as Error).stack);
      }
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

    await this.broadcastFlowChanged(taskId);
    return await this.findOneForUser(taskId, ownerId);
  }

  async create(dto: CreatePriorityTaskDto, userId: string): Promise<PriorityTaskView> {
    this.logger.debug(`create called by ${userId} (title="${dto.title}", quadrant=${dto.quadrant})`);
    try {
      const view = await this.dataSource.transaction(async (manager) => {
        const lock = { mode: "pessimistic_write" as const };
        const rank = await this.nextRank(userId, dto.quadrant, BOARD_TYPES, manager, lock);
        this.logger.debug(`Placing at rank ${rank} in quadrant ${dto.quadrant}`);

        const taskRepo = manager.getRepository(PriorityTask);
        const task = taskRepo.create({
          title: dto.title,
          notes: dto.notes,
          // Manager-bound repo, not this.priorityTasksRepo -- createScoped()
          // isn't reachable on a transactional manager, so tenantId is set
          // by hand here instead (same value createScoped would have used).
          tenantId: this.tenantContext.getTenantId(),
          createdBy: userId,
          updatedBy: userId,
        });
        const savedTask = await taskRepo.save(task);

        const flowRepo = manager.getRepository(PriorityTaskFlow);
        const row = await flowRepo.save(
          flowRepo.create({
            taskId: savedTask.id,
            userId,
            seq: 1,
            eventType: PriorityTaskFlowEventType.Placed,
            quadrant: dto.quadrant,
            rank,
            progress: 0,
            isCurrent: true,
            createdBy: userId,
          }),
        );
        return this.rowToView(savedTask, row);
      });
      this.logger.debug(`create succeeded for priority task ${view.id}`);

      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: view.id,
        action: "insert",
        actorId: userId,
        changes: {
          title: view.title,
          notes: view.notes,
          quadrant: view.quadrant,
          rank: view.rank,
          ownerId: view.ownerId,
          status: view.status,
          progress: view.progress,
        },
      });
      await this.broadcastFlowChanged(view.id);
      return view;
    } catch (err) {
      this.logger.error(`create failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Story 1.3 -- reorder/move within the board. Position only: mutates
  // quadrant/rank in place on the viewer's current row(s), never opens a new
  // flow row -- a drag-reorder isn't a hop in the task's custody (see the
  // entity's own comment on why seq only bumps for real hops).
  async move(taskId: string, userId: string, dto: MovePriorityTaskDto): Promise<PriorityTaskView> {
    this.logger.debug(`move called for task ${taskId} by ${userId} (quadrant=${dto.quadrant}, index=${dto.index})`);
    try {
      await this.dataSource.transaction(async (manager) => {
        const lock = { mode: "pessimistic_write" as const };
        const flowRepo = manager.getRepository(PriorityTaskFlow);
        const [row] = await flowRepo.find({
          where: { taskId, userId, isCurrent: true, eventType: In(BOARD_TYPES) },
          take: 1,
          lock,
        });
        if (!row) throw new NotFoundException("Task not found");

        const fromQuadrant = row.quadrant as PriorityTaskQuadrant;
        const toQuadrant = dto.quadrant;

        if (fromQuadrant === toQuadrant) {
          this.logger.debug(`Reordering within quadrant ${toQuadrant}`);
          const siblings = await flowRepo.find({
            where: { userId, quadrant: toQuadrant, isCurrent: true, eventType: In(BOARD_TYPES) },
            order: { rank: "ASC" },
            lock,
          });
          const others = siblings.filter((sibling) => sibling.id !== row.id);
          others.splice(clampIndex(dto.index, others.length), 0, row);
          await this.resequence(others, manager);
        } else {
          this.logger.debug(`Moving task from ${fromQuadrant} to ${toQuadrant}`);
          const oldSiblings = (
            await flowRepo.find({
              where: { userId, quadrant: fromQuadrant, isCurrent: true, eventType: In(BOARD_TYPES) },
              order: { rank: "ASC" },
              lock,
            })
          ).filter((sibling) => sibling.id !== row.id);
          await this.resequence(oldSiblings, manager);

          const newSiblings = await flowRepo.find({
            where: { userId, quadrant: toQuadrant, isCurrent: true, eventType: In(BOARD_TYPES) },
            order: { rank: "ASC" },
            lock,
          });
          row.quadrant = toQuadrant;
          newSiblings.splice(clampIndex(dto.index, newSiblings.length), 0, row);
          await this.resequence(newSiblings, manager);
        }
      });
      this.logger.debug(`move succeeded for task ${taskId}`);
    } catch (err) {
      this.logger.error(`move failed for task ${taskId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }

    await this.broadcastFlowChanged(taskId);
    return await this.findOneOwnedOrFail(taskId, userId);
  }
}

function clampIndex(index: number, length: number): number {
  return Math.min(Math.max(index, 0), length);
}
