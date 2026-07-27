import { PriorityTaskDelegationTrackerResponse, PriorityTaskResponse } from "@orelia/common";
import { Body, Controller, Get, Logger, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { CreatePriorityTaskDto } from "./dto/create-priority-task.dto";
import { DelegatePriorityTaskDto } from "./dto/delegate-priority-task.dto";
import { MovePriorityTaskDto } from "./dto/move-priority-task.dto";
import { UpdatePriorityTaskDto } from "./dto/update-priority-task.dto";
import { UpdatePriorityTaskProgressDto } from "./dto/update-priority-task-progress.dto";
import { PriorityTaskDelegationTracker } from "./entities/priority-task-delegation-tracker.entity";
import { PriorityTask } from "./entities/priority-task.entity";
import { PriorityTasksService } from "./priority-tasks.service";

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
      this.logger.debug(`GET /priority-tasks returning ${tasks.length} row(s)`);
      return tasks.map((task) => this.toResponse(task, user.sub));
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
      return this.toResponse(task, user.sub);
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
      return this.toResponse(task, user.sub);
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
      return this.toResponse(task, user.sub, creatorName);
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
      return this.toResponse(task, user.sub, creatorName);
    } catch (err) {
      this.logger.error(`PATCH /priority-tasks/${id} failed: ${(err as Error).message}`, (err as Error).stack);
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
      return this.toResponse(task, user.sub);
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
      return this.toResponse(task, user.sub);
    } catch (err) {
      this.logger.error(`PATCH /priority-tasks/${id}/move failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  private async toTrackerResponse(
    tracker: PriorityTaskDelegationTracker,
  ): Promise<PriorityTaskDelegationTrackerResponse> {
    // `task` is eager-loaded by the service's own query (relations:
    // ["task"]) -- a tracker with no task would mean the FK's ON DELETE
    // CASCADE didn't fire, which should be impossible, but fail loudly
    // rather than silently rendering a blank card if it ever happens.
    if (!tracker.task) {
      throw new Error(`Delegation tracker ${tracker.id} has no linked task`);
    }
    const delegatedToName = await this.priorityTasksService.getUserDisplayName(tracker.task.delegatedToUserId);
    return {
      id: tracker.id,
      taskId: tracker.taskId,
      taskTitle: tracker.task.title,
      taskStatus: tracker.task.status,
      taskProgress: tracker.task.progress,
      delegatedToUserId: tracker.task.delegatedToUserId ?? "",
      delegatedToName: delegatedToName ?? "",
      rank: tracker.rank,
      createdAt: tracker.createdAt.toISOString(),
    };
  }

  private toResponse(task: PriorityTask, viewerId: string, creatorName?: string | null): PriorityTaskResponse {
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
      createdAt: task.createdAt.toISOString(),
      ...(creatorName !== undefined ? { createdByName: creatorName } : {}),
    };
  }
}
