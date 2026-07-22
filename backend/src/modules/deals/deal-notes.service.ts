import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { CreateDealNoteDto } from "./dto/create-deal-note.dto";
import { UpdateDealNoteDto } from "./dto/update-deal-note.dto";
import { DealNote } from "./entities/deal-note.entity";
import { DealsService } from "./deals.service";

const AUDIT_ENTITY_TYPE = "deal_note";

@Injectable()
export class DealNotesService {
  private readonly logger = new Logger(DealNotesService.name);

  constructor(
    @InjectRepository(DealNote) private readonly repo: Repository<DealNote>,
    private readonly dealsService: DealsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(dealId: string): Promise<DealNote[]> {
    this.logger.debug(`findAll called for deal ${dealId}`);
    // Confirms the deal exists and belongs to the current tenant before
    // touching its notes -- DealNote has no tenant_id of its own, same
    // reasoning as DealDocument.
    await this.dealsService.findOneOrFail(dealId);
    const notes = await this.repo.find({
      where: { dealId },
      relations: ["authorUser"],
      order: { createdAt: "ASC" },
    });
    this.logger.debug(`findAll returning ${notes.length} note(s) for deal ${dealId}`);
    return notes;
  }

  async findOneOrFail(dealId: string, noteId: string): Promise<DealNote> {
    const note = await this.repo.findOne({ where: { id: noteId, dealId }, relations: ["authorUser"] });
    if (!note) {
      throw new NotFoundException("Deal note not found");
    }
    return note;
  }

  async create(dealId: string, dto: CreateDealNoteDto, userId: string): Promise<DealNote> {
    this.logger.debug(`create called for deal ${dealId} by ${userId}`);
    await this.dealsService.findOneOrFail(dealId);
    try {
      const note = this.repo.create({ dealId, text: dto.text, createdBy: userId });
      const saved = await this.repo.save(note);
      this.logger.debug(`create succeeded, note ${saved.id}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: saved.id,
        action: "insert",
        actorId: userId,
        changes: { dealId, text: saved.text },
      });
      // Re-fetch rather than return the saved object -- save() doesn't
      // populate the authorUser relation, so the response would be missing
      // the display name otherwise.
      return this.findOneOrFail(dealId, saved.id);
    } catch (err) {
      this.logger.error(`create failed for deal ${dealId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Only the note's own author may edit it -- everyone who can see the deal
  // can read every note, but editing is author-restricted (per the client
  // spec baked into AddDealDialog.tsx's comment thread design). Distinct
  // from deal_documents, which has no equivalent ownership check.
  async update(dealId: string, noteId: string, dto: UpdateDealNoteDto, userId: string): Promise<DealNote> {
    this.logger.debug(`update called for note ${noteId} on deal ${dealId} by ${userId}`);
    const note = await this.findOneOrFail(dealId, noteId);

    if (note.createdBy !== userId) {
      this.logger.debug(`Blocked: ${userId} is not the author of note ${noteId} (author=${note.createdBy})`);
      throw new ForbiddenException("Only the author of this note can edit it");
    }

    try {
      const before = note.text;
      note.text = dto.text;
      note.updatedBy = userId;
      await this.repo.save(note);
      this.logger.debug(`update succeeded for note ${noteId}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: noteId,
        action: "update",
        actorId: userId,
        changes: { text: { old: before, new: dto.text } },
      });
      return this.findOneOrFail(dealId, noteId);
    } catch (err) {
      this.logger.error(`update failed for note ${noteId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
