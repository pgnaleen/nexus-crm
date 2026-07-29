import { PriorityTaskMessageResponse } from "@orelia/common";
import { Body, Controller, Get, Logger, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { CreatePriorityTaskMessageDto } from "./dto/create-priority-task-message.dto";
import { PriorityTaskMessage } from "./entities/priority-task-message.entity";
import { PriorityTaskMessagesService } from "./priority-task-messages.service";
import { PriorityTasksService } from "./priority-tasks.service";

// No PermissionsGuard/RequirePermission -- same auth-only access model as
// the rest of Priority Tasks. Access is gated in the service via
// PriorityTasksService.findOneForUser's broader rule (owner, tracker-holder,
// share recipient, or pending delegate) -- not owner-only, unlike shares.
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
      const authorName = await this.priorityTasksService.getUserDisplayName(message.userId);
      return {
        id: message.id,
        userId: message.userId,
        authorName: authorName ?? "",
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      };
    } catch (err) {
      this.logger.error(
        `POST /priority-tasks/${taskId}/messages failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    }
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
    return messages.map((message) => ({
      id: message.id,
      userId: message.userId,
      authorName: names.get(message.userId) ?? "",
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    }));
  }
}
