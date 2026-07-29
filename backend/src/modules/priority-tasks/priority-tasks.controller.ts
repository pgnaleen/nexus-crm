import {
  IncomingTaskResponse,
  PriorityTaskDelegationTrackerResponse,
  PriorityTaskHistoryEntry,
  PriorityTaskResponse,
} from "@orelia/common";
import { Body, Controller, Delete, Get, Logger, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { AcceptPriorityTaskDto } from "./dto/accept-priority-task.dto";
import { CreatePriorityTaskDto } from "./dto/create-priority-task.dto";
import { DelegatePriorityTaskDto } from "./dto/delegate-priority-task.dto";
import { MovePriorityTaskDto } from "./dto/move-priority-task.dto";
import { UpdatePriorityTaskDto } from "./dto/update-priority-task.dto";
import { UpdatePriorityTaskProgressDto } from "./dto/update-priority-task-progress.dto";
import { DelegationTrackerView, PriorityTasksService, PriorityTaskView } from "./priority-tasks.service";

// No PermissionsGuard/RequirePermission anywhere in this controller -- the
// global JwtAuthGuard (authentication only) is the entire access rule, same
// as users.controller.ts's changeOwnPassword. Every user manages only their
// own personal board (Priority Tracker epic, "gated by authentication only,
// no RBAC permission").
@Controller("priority-tasks")
export class PriorityTasksController {
  private readonly logger = new Logger(PriorityTasksController.name);

  constructor(private readonly priorityTasksService: PriorityTasksService) {}

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser): Promise<PriorityTaskResponse[]> {
    this.logger.debug(`GET /priority-tasks called by ${user.sub}`);
    try {
      const tasks = await this.priorityTasksService.findAllForUser(user.sub);
      // Story 2.3 -- one grouped query for every card's "Shared" pill,
      // rather than letting toResponse fire one count per task.
      const shareCounts = await this.priorityTasksService.countSharesByTaskIds(tasks.map((task) => task.id));
      this.logger.debug(`GET /priority-tasks returning ${tasks.length} row(s)`);
      return await Promise.all(
        tasks.map((task) => this.toResponse(task, user.sub, undefined, shareCounts.get(task.id) ?? 0)),
      );
    } catch (err) {
      this.logger.error(`GET /priority-tasks failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @Post()
  async create(
    @Body() dto: CreatePriorityTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PriorityTaskResponse> {
    this.logger.debug(`POST /priority-tasks called by ${user.sub} (title="${dto.title}")`);
    try {
      const task = await this.priorityTasksService.create(dto, user.sub);
      this.logger.debug(`POST /priority-tasks succeeded for task ${task.id}`);
      return await this.toResponse(task, user.sub);
    } catch (err) {
      this.logger.error(`POST /priority-tasks failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Declared before ":id" so "delegated-trackers" isn't swallowed as a
  // route param (same fix as GET /deals/partner-links earlier this
  // project). Story 1.6 -- the delegator's own tracking cards for the
  // DELEGATE quadrant.
  @Get("delegated-trackers")
  async findDelegationTrackers(@CurrentUser() user: AuthenticatedUser): Promise<PriorityTaskDelegationTrackerResponse[]> {
    this.logger.debug(`GET /priority-tasks/delegated-trackers called by ${user.sub}`);
    try {
      const trackers = await this.priorityTasksService.findDelegationTrackersForUser(user.sub);
      const responses = await Promise.all(trackers.map((tracker) => this.toTrackerResponse(tracker)));
      this.logger.debug(`GET /priority-tasks/delegated-trackers returning ${responses.length} row(s)`);
      return responses;
    } catch (err) {
      this.logger.error(
        `GET /priority-tasks/delegated-trackers failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    }
  }

  // Declared before ":id" (literal segment). Story 1.8 -- everything shared
  // or delegated to me.
  @Get("incoming")
  async findIncoming(@CurrentUser() user: AuthenticatedUser): Promise<IncomingTaskResponse[]> {
    this.logger.debug(`GET /priority-tasks/incoming called by ${user.sub}`);
    try {
      const items = await this.priorityTasksService.findIncomingForUser(user.sub);
      this.logger.debug(`GET /priority-tasks/incoming returning ${items.length} row(s)`);
      return items;
    } catch (err) {
      this.logger.error(`GET /priority-tasks/incoming failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Declared before ":id". Story 1.10 -- my archived tasks.
  @Get("archived")
  async findArchived(@CurrentUser() user: AuthenticatedUser): Promise<PriorityTaskResponse[]> {
    this.logger.debug(`GET /priority-tasks/archived called by ${user.sub}`);
    try {
      const tasks = await this.priorityTasksService.findArchivedForUser(user.sub);
      const shareCounts = await this.priorityTasksService.countSharesByTaskIds(tasks.map((task) => task.id));
      // Story 2.10 -- the Archive row's "by {creator}" attribution. Resolved
      // per distinct creator, not per row: an archive of 30 tasks you made
      // yourself is one lookup, not 30.
      const creatorIds = [...new Set(tasks.map((task) => task.createdBy).filter((id): id is string => Boolean(id)))];
      this.logger.debug(`Resolving ${creatorIds.length} distinct creator name(s) for ${tasks.length} archived task(s)`);
      const creatorNames = new Map(
        await Promise.all(
          creatorIds.map(
            async (id) => [id, await this.priorityTasksService.getUserDisplayName(id)] as const,
          ),
        ),
      );
      this.logger.debug(`GET /priority-tasks/archived returning ${tasks.length} row(s)`);
      return await Promise.all(
        tasks.map((task) =>
          this.toResponse(
            task,
            user.sub,
            task.createdBy ? (creatorNames.get(task.createdBy) ?? null) : null,
            shareCounts.get(task.id) ?? 0,
          ),
        ),
      );
    } catch (err) {
      this.logger.error(`GET /priority-tasks/archived failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Story 2.10 -- permanently clear an archived task out of the Archive.
  // Soft delete: the row keeps existing with deletedAt/deletedBy set, it just
  // stops being returned anywhere. Only an archived task qualifies -- see the
  // service method's own comment for why.
  @Delete(":id")
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    this.logger.debug(`DELETE /priority-tasks/${id} called by ${user.sub}`);
    try {
      await this.priorityTasksService.remove(id, user.sub);
      this.logger.debug(`DELETE /priority-tasks/${id} succeeded`);
      return { success: true };
    } catch (err) {
      this.logger.error(`DELETE /priority-tasks/${id} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Story 1.10 -- archive a completed task off my board.
  @Patch(":id/archive")
  async archive(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PriorityTaskResponse> {
    this.logger.debug(`PATCH /priority-tasks/${id}/archive called by ${user.sub}`);
    try {
      const task = await this.priorityTasksService.archive(id, user.sub);
      this.logger.debug(`PATCH /priority-tasks/${id}/archive succeeded`);
      return await this.toResponse(task, user.sub);
    } catch (err) {
      this.logger.error(`PATCH /priority-tasks/${id}/archive failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Story 1.10 -- restore an archived task to my board.
  @Patch(":id/restore")
  async restore(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PriorityTaskResponse> {
    this.logger.debug(`PATCH /priority-tasks/${id}/restore called by ${user.sub}`);
    try {
      const task = await this.priorityTasksService.restore(id, user.sub);
      this.logger.debug(`PATCH /priority-tasks/${id}/restore succeeded`);
      return await this.toResponse(task, user.sub);
    } catch (err) {
      this.logger.error(`PATCH /priority-tasks/${id}/restore failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Story 1.8 -- accept a delegated task onto my own board (ownership
  // transfers to me).
  @Post(":id/accept")
  async accept(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AcceptPriorityTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PriorityTaskResponse> {
    this.logger.debug(`POST /priority-tasks/${id}/accept called by ${user.sub} (quadrant=${dto.quadrant})`);
    try {
      const task = await this.priorityTasksService.accept(id, user.sub, dto);
      this.logger.debug(`POST /priority-tasks/${id}/accept succeeded`);
      return await this.toResponse(task, user.sub);
    } catch (err) {
      this.logger.error(`POST /priority-tasks/${id}/accept failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Story 1.8 -- pass a task delegated to me on to someone else without
  // accepting it (ownership stays with the original delegator).
  @Post(":id/redelegate")
  async redelegate(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DelegatePriorityTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PriorityTaskResponse> {
    this.logger.debug(`POST /priority-tasks/${id}/redelegate called by ${user.sub} (userId=${dto.userId})`);
    try {
      const task = await this.priorityTasksService.redelegate(id, user.sub, dto);
      this.logger.debug(`POST /priority-tasks/${id}/redelegate succeeded`);
      return await this.toResponse(task, user.sub);
    } catch (err) {
      this.logger.error(`POST /priority-tasks/${id}/redelegate failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @Post(":id/delegate")
  async delegate(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DelegatePriorityTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PriorityTaskResponse> {
    this.logger.debug(`POST /priority-tasks/${id}/delegate called by ${user.sub} (userId=${dto.userId})`);
    try {
      const task = await this.priorityTasksService.delegate(id, user.sub, dto);
      this.logger.debug(`POST /priority-tasks/${id}/delegate succeeded`);
      return await this.toResponse(task, user.sub);
    } catch (err) {
      this.logger.error(`POST /priority-tasks/${id}/delegate failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @Get(":id")
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PriorityTaskResponse> {
    this.logger.debug(`GET /priority-tasks/${id} called by ${user.sub}`);
    try {
      const task = await this.priorityTasksService.findOneForUser(id, user.sub);
      const creatorName = await this.priorityTasksService.getUserDisplayName(task.createdBy);
      this.logger.debug(`GET /priority-tasks/${id} succeeded`);
      return await this.toResponse(task, user.sub, creatorName);
    } catch (err) {
      this.logger.error(`GET /priority-tasks/${id} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdatePriorityTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PriorityTaskResponse> {
    this.logger.debug(`PATCH /priority-tasks/${id} called by ${user.sub}`);
    try {
      const task = await this.priorityTasksService.updateNotes(id, user.sub, dto);
      const creatorName = await this.priorityTasksService.getUserDisplayName(task.createdBy);
      this.logger.debug(`PATCH /priority-tasks/${id} succeeded`);
      return await this.toResponse(task, user.sub, creatorName);
    } catch (err) {
      this.logger.error(`PATCH /priority-tasks/${id} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @Get(":id/history")
  async getHistory(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PriorityTaskHistoryEntry[]> {
    this.logger.debug(`GET /priority-tasks/${id}/history called by ${user.sub}`);
    try {
      const entries = await this.priorityTasksService.getHistory(id, user.sub);
      this.logger.debug(`GET /priority-tasks/${id}/history returning ${entries.length} entry(ies)`);
      return entries;
    } catch (err) {
      this.logger.error(`GET /priority-tasks/${id}/history failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Story 1.9 -- owner marks the task complete (prerequisite for archive).
  @Patch(":id/complete")
  async complete(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PriorityTaskResponse> {
    this.logger.debug(`PATCH /priority-tasks/${id}/complete called by ${user.sub}`);
    try {
      const task = await this.priorityTasksService.complete(id, user.sub);
      this.logger.debug(`PATCH /priority-tasks/${id}/complete succeeded`);
      return await this.toResponse(task, user.sub);
    } catch (err) {
      this.logger.error(`PATCH /priority-tasks/${id}/complete failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @Patch(":id/progress")
  async updateProgress(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdatePriorityTaskProgressDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PriorityTaskResponse> {
    this.logger.debug(`PATCH /priority-tasks/${id}/progress called by ${user.sub} (progress=${dto.progress})`);
    try {
      const task = await this.priorityTasksService.updateProgress(id, user.sub, dto);
      this.logger.debug(`PATCH /priority-tasks/${id}/progress succeeded`);
      return await this.toResponse(task, user.sub);
    } catch (err) {
      this.logger.error(`PATCH /priority-tasks/${id}/progress failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @Patch(":id/move")
  async move(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: MovePriorityTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PriorityTaskResponse> {
    this.logger.debug(
      `PATCH /priority-tasks/${id}/move called by ${user.sub} (quadrant=${dto.quadrant}, index=${dto.index})`,
    );
    try {
      const task = await this.priorityTasksService.move(id, user.sub, dto);
      this.logger.debug(`PATCH /priority-tasks/${id}/move succeeded`);
      return await this.toResponse(task, user.sub);
    } catch (err) {
      this.logger.error(`PATCH /priority-tasks/${id}/move failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  private async toTrackerResponse(
    tracker: DelegationTrackerView,
  ): Promise<PriorityTaskDelegationTrackerResponse> {
    // Story 3.2 -- the service resolves who currently holds the task
    // (delegatedToUserId here) live-joined from priority_task_flow, not a
    // frozen snapshot: the pending recipient before acceptance, the real
    // holder once accepted (Story 1.8/2.4).
    const delegatedToName = await this.priorityTasksService.getUserDisplayName(tracker.delegatedToUserId);
    return {
      id: tracker.id,
      taskId: tracker.taskId,
      taskTitle: tracker.taskTitle,
      taskStatus: tracker.taskStatus,
      taskProgress: tracker.taskProgress,
      delegatedToUserId: tracker.delegatedToUserId,
      delegatedToName: delegatedToName ?? "",
      rank: tracker.rank,
      createdAt: tracker.createdAt.toISOString(),
    };
  }

  // Async because `shareCount` (Story 2.3) needs a lookup when the caller
  // hasn't already batched it -- the list endpoints pass a pre-fetched count
  // so N cards cost one query; every single-task endpoint lets it resolve
  // one here rather than shipping a stale 0 that would drop the card's
  // "Shared" pill right after an unrelated edit.
  private async toResponse(
    task: PriorityTaskView,
    viewerId: string,
    creatorName?: string | null,
    shareCount?: number,
  ): Promise<PriorityTaskResponse> {
    const resolvedShareCount =
      shareCount ?? (await this.priorityTasksService.countSharesForTask(task.id));
    return {
      id: task.id,
      title: task.title,
      notes: task.notes ?? null,
      quadrant: task.quadrant,
      rank: task.rank,
      status: task.status,
      progress: task.progress,
      ownerId: task.ownerId,
      // Relative to whoever's asking -- see the contract's own comment for
      // why this is ownerId-vs-viewer, not createdBy-vs-ownerId (sharing
      // never moves ownerId, so a shared recipient must still see
      // "received" even though the task's real owner never changed).
      ownership: task.ownerId === viewerId ? "owned" : "received",
      // Story 2.3 -- the orthogonal "did I make this, or did I inherit it via
      // an accepted delegation" axis that `ownership` deliberately can't
      // express. createdBy comes from AuditedTenantEntity and never changes.
      isCreator: task.createdBy === viewerId,
      // Story 2.4 -- the delegator keeps ownerId until the recipient accepts,
      // so "am I the owner" is not the same question as "may I edit". A
      // pending delegation makes the owner a read-only tracker of their own
      // task; without this the delegator's tracking card would open with full
      // edit controls on work they've already handed off.
      canEdit: task.ownerId === viewerId && !task.delegatedToUserId,
      shareCount: resolvedShareCount,
      createdAt: task.createdAt.toISOString(),
      ...(creatorName !== undefined ? { createdByName: creatorName } : {}),
    };
  }
}
