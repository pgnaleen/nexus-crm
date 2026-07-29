import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { PRIORITY_TASK_MESSAGE_EVENT, RealtimeService } from "../../core/realtime";
import { TenantContextService } from "../../core/tenant";
import { PriorityTaskMessage } from "./entities/priority-task-message.entity";
import { CreatePriorityTaskMessageDto } from "./dto/create-priority-task-message.dto";
import { PriorityTasksService } from "./priority-tasks.service";

const AUDIT_ENTITY_TYPE = "priority_task_message";

// Epic 3, Story 3.3 -- task chat. Access is deliberately the BROADER
// findOneForUser rule (owner, current tracker-holder, share recipient, or
// pending delegate), not the owner-only rule PriorityTaskSharesService
// uses -- a shared recipient can only read the task itself, but everyone
// with any relationship to it can take part in its discussion.
@Injectable()
export class PriorityTaskMessagesService {
  private readonly logger = new Logger(PriorityTaskMessagesService.name);

  constructor(
    @InjectRepository(PriorityTaskMessage) private readonly repo: Repository<PriorityTaskMessage>,
    private readonly priorityTasksService: PriorityTasksService,
    private readonly auditLogService: AuditLogService,
    private readonly realtimeService: RealtimeService,
    private readonly tenantContext: TenantContextService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findAll(taskId: string, userId: string): Promise<PriorityTaskMessage[]> {
    this.logger.debug(`findAll called for task ${taskId} by ${userId}`);
    try {
      await this.priorityTasksService.findOneForUser(taskId, userId); // access check (404 if none)
      const messages = await this.repo.find({
        where: { taskId },
        order: { seq: "ASC" },
      });
      this.logger.debug(`findAll returning ${messages.length} message(s) for task ${taskId}`);
      return messages;
    } catch (err) {
      this.logger.error(`findAll failed for task ${taskId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async add(taskId: string, userId: string, dto: CreatePriorityTaskMessageDto): Promise<PriorityTaskMessage> {
    this.logger.debug(`add called for task ${taskId} by ${userId}`);
    try {
      await this.priorityTasksService.findOneForUser(taskId, userId); // access check (404 if none)

      const saved = await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(PriorityTaskMessage);
        const result = await repo
          .createQueryBuilder("message")
          .select("MAX(message.seq)", "max")
          .where("message.taskId = :taskId", { taskId })
          .getRawOne<{ max: number | null }>();
        const message = repo.create({
          taskId,
          userId,
          seq: (result?.max ?? 0) + 1,
          body: dto.body,
          createdBy: userId,
        });
        return repo.save(message);
      });
      this.logger.debug(`add succeeded, message ${saved.id} (seq ${saved.seq}) on task ${taskId}`);

      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: saved.id,
        action: "insert",
        actorId: userId,
        changes: { taskId, seq: saved.seq, body: saved.body },
      });

      await this.broadcastMessage(taskId, saved, userId);

      return saved;
    } catch (err) {
      this.logger.error(`add failed for task ${taskId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Epic 3, Story 3.5 -- pushes the message itself (not a "go re-fetch"
  // signal the way flow-changed is) to every user getAccessibleUserIds says
  // could open this thread at all -- same access rule findOneForUser/add
  // already enforced, computed once and reused, not re-derived. Includes the
  // sender themselves, so their other open tabs/devices update too; the
  // frontend dedupes by message id since the sender's own tab already
  // appended it from the HTTP response.
  private async broadcastMessage(taskId: string, message: PriorityTaskMessage, senderId: string): Promise<void> {
    try {
      const authorName = await this.priorityTasksService.getUserDisplayName(senderId);
      const userIds = await this.priorityTasksService.getAccessibleUserIds(taskId);
      this.realtimeService.emitToUsers(this.tenantContext.getTenantId(), userIds, PRIORITY_TASK_MESSAGE_EVENT, {
        taskId,
        message: {
          id: message.id,
          userId: message.userId,
          authorName: authorName ?? "",
          body: message.body,
          createdAt: message.createdAt.toISOString(),
        },
      });
    } catch (err) {
      this.logger.error(`broadcastMessage failed for task ${taskId}: ${(err as Error).message}`, (err as Error).stack);
    }
  }
}
