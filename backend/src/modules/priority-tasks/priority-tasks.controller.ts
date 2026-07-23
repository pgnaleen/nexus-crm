import { PriorityTaskResponse } from "@orelia/common";
import { Body, Controller, Get, Logger, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { CreatePriorityTaskDto } from "./dto/create-priority-task.dto";
import { MovePriorityTaskDto } from "./dto/move-priority-task.dto";
import { UpdatePriorityTaskDto } from "./dto/update-priority-task.dto";
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
      return tasks.map((task) => this.toResponse(task));
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
      return this.toResponse(task);
    } catch (err) {
      this.logger.error(`POST /priority-tasks failed: ${(err as Error).message}`, (err as Error).stack);
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
      return this.toResponse(task, creatorName);
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
      return this.toResponse(task, creatorName);
    } catch (err) {
      this.logger.error(`PATCH /priority-tasks/${id} failed: ${(err as Error).message}`, (err as Error).stack);
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
      return this.toResponse(task);
    } catch (err) {
      this.logger.error(`PATCH /priority-tasks/${id}/move failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  private toResponse(task: PriorityTask, creatorName?: string | null): PriorityTaskResponse {
    return {
      id: task.id,
      title: task.title,
      notes: task.notes ?? null,
      quadrant: task.quadrant,
      rank: task.rank,
      status: task.status,
      progress: task.progress,
      ownerId: task.ownerId,
      ownership: task.createdBy === task.ownerId ? "owned" : "received",
      createdAt: task.createdAt.toISOString(),
      ...(creatorName !== undefined ? { createdByName: creatorName } : {}),
    };
  }
}
