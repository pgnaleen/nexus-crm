import { PriorityTaskShareResponse } from "@orelia/common";
import { Body, Controller, Delete, Get, Logger, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { CreatePriorityTaskShareDto } from "./dto/create-priority-task-share.dto";
import { PriorityTaskShare } from "./entities/priority-task-share.entity";
import { PriorityTaskSharesService } from "./priority-task-shares.service";

// No PermissionsGuard/RequirePermission -- same auth-only access model as
// the rest of Priority Tasks. Every method below is owner-only underneath
// (see PriorityTaskSharesService), enforced independently of these routes.
@Controller("priority-tasks/:taskId/shares")
export class PriorityTaskSharesController {
  private readonly logger = new Logger(PriorityTaskSharesController.name);

  constructor(private readonly sharesService: PriorityTaskSharesService) {}

  @Get()
  async findAll(
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PriorityTaskShareResponse[]> {
    this.logger.debug(`GET /priority-tasks/${taskId}/shares called by ${user.sub}`);
    try {
      const shares = await this.sharesService.findAll(taskId, user.sub);
      this.logger.debug(`GET /priority-tasks/${taskId}/shares returning ${shares.length} row(s)`);
      return shares.map((share) => this.toResponse(share));
    } catch (err) {
      this.logger.error(`GET /priority-tasks/${taskId}/shares failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @Post()
  async create(
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Body() dto: CreatePriorityTaskShareDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PriorityTaskShareResponse> {
    this.logger.debug(`POST /priority-tasks/${taskId}/shares called by ${user.sub} (userId=${dto.userId})`);
    try {
      const share = await this.sharesService.add(taskId, user.sub, dto);
      this.logger.debug(`POST /priority-tasks/${taskId}/shares succeeded, share ${share.id}`);
      return this.toResponse(share);
    } catch (err) {
      this.logger.error(`POST /priority-tasks/${taskId}/shares failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @Delete(":shareId")
  async remove(
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Param("shareId", ParseUUIDPipe) shareId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    this.logger.debug(`DELETE /priority-tasks/${taskId}/shares/${shareId} called by ${user.sub}`);
    try {
      await this.sharesService.remove(taskId, user.sub, shareId);
      this.logger.debug(`DELETE /priority-tasks/${taskId}/shares/${shareId} succeeded`);
      return { success: true };
    } catch (err) {
      this.logger.error(
        `DELETE /priority-tasks/${taskId}/shares/${shareId} failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    }
  }

  private toResponse(share: PriorityTaskShare): PriorityTaskShareResponse {
    return {
      id: share.id,
      userId: share.sharedWithUserId,
      displayName: share.sharedWithUser?.displayName ?? "",
      createdAt: share.createdAt.toISOString(),
    };
  }
}
