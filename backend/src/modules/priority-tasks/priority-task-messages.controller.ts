import { PriorityTaskMessageResponse } from "@orelia/common";
import { Body, Controller, Delete, Get, Logger, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { CreatePriorityTaskMessageDto } from "./dto/create-priority-task-message.dto";
import { UpdatePriorityTaskMessageDto } from "./dto/update-priority-task-message.dto";
import { PriorityTaskMessage } from "./entities/priority-task-message.entity";
import { PriorityTaskMessagesService } from "./priority-task-messages.service";
import { PriorityTasksService } from "./priority-tasks.service";

// No PermissionsGuard/RequirePermission -- same auth-only access model as
// the rest of Priority Tasks. Read/post access is gated in the service via
// PriorityTasksService.findOneForUser's broader rule (owner, tracker-holder,
// share recipient, or pending delegate) -- not owner-only, unlike shares.
// Edit/delete is narrower still, enforced in the service: only the
// message's own author.
@Controller("priority-tasks/:taskId/messages")
export class PriorityTaskMessagesController {
  private readonly logger = new Logger(PriorityTaskMessagesController.name);

  constructor(
    private readonly messagesService: PriorityTaskMessagesService,
    private readonly priorityTasksService: PriorityTasksService,
  ) {}

  @Get()
  async findAll(
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PriorityTaskMessageResponse[]> {
    this.logger.debug(`GET /priority-tasks/${taskId}/messages called by ${user.sub}`);
    try {
      const messages = await this.messagesService.findAll(taskId, user.sub);
      this.logger.debug(`GET /priority-tasks/${taskId}/messages returning ${messages.length} row(s)`);
      return await this.toResponses(messages);
    } catch (err) {
      this.logger.error(
        `GET /priority-tasks/${taskId}/messages failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    }
  }

  @Post()
  async create(
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Body() dto: CreatePriorityTaskMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PriorityTaskMessageResponse> {
    this.logger.debug(`POST /priority-tasks/${taskId}/messages called by ${user.sub}`);
    try {
      const message = await this.messagesService.add(taskId, user.sub, dto);
      this.logger.debug(`POST /priority-tasks/${taskId}/messages succeeded, message ${message.id}`);
      return await this.toResponse(message);
    } catch (err) {
      this.logger.error(
        `POST /priority-tasks/${taskId}/messages failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    }
  }

  @Patch(":messageId")
  async update(
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Param("messageId", ParseUUIDPipe) messageId: string,
    @Body() dto: UpdatePriorityTaskMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PriorityTaskMessageResponse> {
    this.logger.debug(`PATCH /priority-tasks/${taskId}/messages/${messageId} called by ${user.sub}`);
    try {
      const message = await this.messagesService.update(taskId, messageId, user.sub, dto);
      this.logger.debug(`PATCH /priority-tasks/${taskId}/messages/${messageId} succeeded`);
      return await this.toResponse(message);
    } catch (err) {
      this.logger.error(
        `PATCH /priority-tasks/${taskId}/messages/${messageId} failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    }
  }

  @Delete(":messageId")
  async remove(
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Param("messageId", ParseUUIDPipe) messageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PriorityTaskMessageResponse> {
    this.logger.debug(`DELETE /priority-tasks/${taskId}/messages/${messageId} called by ${user.sub}`);
    try {
      const message = await this.messagesService.remove(taskId, messageId, user.sub);
      this.logger.debug(`DELETE /priority-tasks/${taskId}/messages/${messageId} succeeded`);
      return await this.toResponse(message);
    } catch (err) {
      this.logger.error(
        `DELETE /priority-tasks/${taskId}/messages/${messageId} failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    }
  }

  // The one place a message's isDeleted/body mask is applied -- a deleted
  // message's real text is never destroyed in the DB (see the entity's own
  // comment), it just never leaves this method in the response.
  private async toResponse(message: PriorityTaskMessage): Promise<PriorityTaskMessageResponse> {
    const authorName = await this.priorityTasksService.getUserDisplayName(message.userId);
    return this.mapResponse(message, authorName ?? "");
  }

  // Batched name resolution -- one lookup per distinct author, not one per
  // message, same discipline as the parent controller's archive attribution.
  private async toResponses(messages: PriorityTaskMessage[]): Promise<PriorityTaskMessageResponse[]> {
    const authorIds = [...new Set(messages.map((message) => message.userId))];
    const names = new Map(
      await Promise.all(
        authorIds.map(async (id) => [id, await this.priorityTasksService.getUserDisplayName(id)] as const),
      ),
    );
    return messages.map((message) => this.mapResponse(message, names.get(message.userId) ?? ""));
  }

  private mapResponse(message: PriorityTaskMessage, authorName: string): PriorityTaskMessageResponse {
    const isDeleted = Boolean(message.deletedAt);
    return {
      id: message.id,
      userId: message.userId,
      authorName,
      body: isDeleted ? "" : message.body,
      createdAt: message.createdAt.toISOString(),
      editedAt: !isDeleted && message.updatedAt ? message.updatedAt.toISOString() : null,
      isDeleted,
    };
  }
}
