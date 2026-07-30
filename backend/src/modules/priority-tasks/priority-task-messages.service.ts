import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { PRIORITY_TASK_MESSAGE_EVENT, RealtimeService } from "../../core/realtime";
import { TenantContextService } from "../../core/tenant";
import { PriorityTaskMessage } from "./entities/priority-task-message.entity";
import { CreatePriorityTaskMessageDto } from "./dto/create-priority-task-message.dto";
import { UpdatePriorityTaskMessageDto } from "./dto/update-priority-task-message.dto";
import { PriorityTasksService } from "./priority-tasks.service";

const AUDIT_ENTITY_TYPE = "priority_task_message";

// Epic 3, Story 3.3 -- task chat. Read/post access is deliberately the
// BROADER findOneForUser rule (owner, current tracker-holder, share
// recipient, or pending delegate), not the owner-only rule
// PriorityTaskSharesService uses -- a shared recipient can only read the
// task itself, but everyone with any relationship to it can take part in
// its discussion. Editing/deleting a message is narrower still: only its
// own author, regardless of their relationship to the task.
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

      await this.broadcastMessageEvent(taskId, saved, userId, "created");

      return saved;
    } catch (err) {
      this.logger.error(`add failed for task ${taskId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Author-only -- narrower than findAll/add's broader task-access rule.
  // 404 (not 403) for "not yours", matching this module's existing
  // never-leak-existence convention (findOneOwnedOrFail etc.).
  async update(
    taskId: string,
    messageId: string,
    userId: string,
    dto: UpdatePriorityTaskMessageDto,
  ): Promise<PriorityTaskMessage> {
    this.logger.debug(`update called for message ${messageId} on task ${taskId} by ${userId}`);
    try {
      const message = await this.repo.findOne({ where: { id: messageId, taskId } });
      if (!message || message.userId !== userId) {
        this.logger.debug(`Blocked: message ${messageId} not found or not authored by ${userId}`);
        throw new NotFoundException("Message not found");
      }
      if (message.deletedAt) {
        this.logger.debug(`Blocked: message ${messageId} is deleted, cannot edit`);
        throw new ConflictException("Cannot edit a deleted message");
      }

      const previousBody = message.body;
      message.body = dto.body;
      message.updatedAt = new Date();
      const saved = await this.repo.save(message);
      this.logger.debug(`update succeeded for message ${messageId}`);

      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: saved.id,
        action: "update",
        actorId: userId,
        changes: { taskId, seq: saved.seq, body: { old: previousBody, new: saved.body } },
      });

      await this.broadcastMessageEvent(taskId, saved, userId, "edited");
      return saved;
    } catch (err) {
      this.logger.error(`update failed for message ${messageId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Soft delete only -- body is never overwritten, the row stays exactly as
  // it was (matches this project's soft-delete-everywhere rule), the
  // response layer is what masks it for a deleted message (see the
  // controller's own toResponse).
  async remove(taskId: string, messageId: string, userId: string): Promise<PriorityTaskMessage> {
    this.logger.debug(`remove called for message ${messageId} on task ${taskId} by ${userId}`);
    try {
      const message = await this.repo.findOne({ where: { id: messageId, taskId } });
      if (!message || message.userId !== userId) {
        this.logger.debug(`Blocked: message ${messageId} not found or not authored by ${userId}`);
        throw new NotFoundException("Message not found");
      }
      if (message.deletedAt) {
        this.logger.debug(`Blocked: message ${messageId} already deleted`);
        throw new ConflictException("Message already deleted");
      }

      message.deletedAt = new Date();
      message.deletedBy = userId;
      const saved = await this.repo.save(message);
      this.logger.debug(`remove succeeded for message ${messageId}`);

      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: saved.id,
        action: "delete",
        actorId: userId,
        changes: { taskId, seq: saved.seq },
      });

      await this.broadcastMessageEvent(taskId, saved, userId, "deleted");
      return saved;
    } catch (err) {
      this.logger.error(`remove failed for message ${messageId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Epic 3, Story 3.5 (extended to cover edit/delete afterward) -- pushes
  // the message itself (not a "go re-fetch" signal the way flow-changed is)
  // to every user getAccessibleUserIds says could open this thread at all --
  // same access rule findOneForUser/add already enforced, computed once and
  // reused, not re-derived. Includes the sender themselves, so their other
  // open tabs/devices update too; the frontend upserts by message id since
  // the sender's own tab already applied the HTTP response locally.
  private async broadcastMessageEvent(
    taskId: string,
    message: PriorityTaskMessage,
    senderId: string,
    kind: "created" | "edited" | "deleted",
  ): Promise<void> {
    try {
      const authorName = await this.priorityTasksService.getUserDisplayName(message.userId);
      const userIds = await this.priorityTasksService.getAccessibleUserIds(taskId);
      const isDeleted = Boolean(message.deletedAt);
      this.realtimeService.emitToUsers(this.tenantContext.getTenantId(), userIds, PRIORITY_TASK_MESSAGE_EVENT, {
        taskId,
        kind,
        message: {
          id: message.id,
          userId: message.userId,
          authorName: authorName ?? "",
          body: isDeleted ? "" : message.body,
          createdAt: message.createdAt.toISOString(),
          editedAt: !isDeleted && message.updatedAt ? message.updatedAt.toISOString() : null,
          isDeleted,
        },
      });
    } catch (err) {
      this.logger.error(
        `broadcastMessageEvent failed for task ${taskId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }
}
