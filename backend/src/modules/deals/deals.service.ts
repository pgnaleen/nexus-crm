import { DealStatus } from "@orelia/common";
import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { CompaniesRepository } from "../companies/companies.repository";
import { ContactsRepository } from "../contacts/contacts.repository";
import { DealSourcesRepository } from "../deal-sources/deal-sources.repository";
import { SubStagesService } from "../deal-stages/sub-stages.service";
import { DepartmentsRepository } from "../departments/departments.repository";
import { EmployeesRepository } from "../employees/employees.repository";
import { CreateDealDto } from "./dto/create-deal.dto";
import { MoveDealDto } from "./dto/move-deal.dto";
import { UpdateDealDto } from "./dto/update-deal.dto";
import { Deal } from "./entities/deal.entity";
import { DealDocument } from "./entities/deal-document.entity";
import { DealNote } from "./entities/deal-note.entity";
import { DealPartnersMap } from "./entities/deal-partners-map.entity";
import { DealStageHistoryService } from "./deal-stage-history.service";
import { DealsRepository } from "./deals.repository";

const AUDIT_ENTITY_TYPE = "deal";

@Injectable()
export class DealsService {
  private readonly logger = new Logger(DealsService.name);

  constructor(
    private readonly dealsRepo: DealsRepository,
    private readonly subStagesService: SubStagesService,
    private readonly stageHistoryService: DealStageHistoryService,
    private readonly auditLogService: AuditLogService,
    private readonly companiesRepo: CompaniesRepository,
    private readonly contactsRepo: ContactsRepository,
    private readonly dealSourcesRepo: DealSourcesRepository,
    private readonly departmentsRepo: DepartmentsRepository,
    private readonly employeesRepo: EmployeesRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // Every FK below is a raw id with no tenant-scoped join, so an id
  // belonging to another tenant (or a soft-deleted row) would otherwise be
  // accepted silently and then resolved back into the response via
  // findOneWithRelations's leftJoinAndSelects -- leaking that other
  // tenant's company/contact/employee/department/source name. Only checks
  // fields actually present on the given dto, so it works for both the
  // create dto (all optional except ownerId) and the update dto (all
  // optional).
  private async validateReferences(
    dto: Partial<CreateDealDto> | Partial<UpdateDealDto>,
  ): Promise<void> {
    const checks: Array<[string, string | undefined, () => Promise<unknown>]> = [
      ["companyId", (dto as CreateDealDto).companyId, () =>
        this.companiesRepo.findOneScoped({ where: { id: (dto as CreateDealDto).companyId } })],
      ["contactId", dto.contactId, () =>
        this.contactsRepo.findOneScoped({ where: { id: dto.contactId } })],
      ["primaryContactId", (dto as CreateDealDto).primaryContactId, () =>
        this.contactsRepo.findOneScoped({ where: { id: (dto as CreateDealDto).primaryContactId } })],
      ["sourceId", dto.sourceId, () =>
        this.dealSourcesRepo.findOneScoped({ where: { id: dto.sourceId } })],
      ["departmentId", dto.departmentId, () =>
        this.departmentsRepo.findOneScoped({ where: { id: dto.departmentId } })],
      ["ownerId", dto.ownerId, () =>
        this.employeesRepo.findOneScoped({ where: { id: dto.ownerId } })],
      ["preSalesPersonId", dto.preSalesPersonId, () =>
        this.employeesRepo.findOneScoped({ where: { id: dto.preSalesPersonId } })],
      ["pmoId", dto.pmoId, () =>
        this.employeesRepo.findOneScoped({ where: { id: dto.pmoId } })],
    ];

    for (const [field, value, load] of checks) {
      if (!value) {
        this.logger.debug(`validateReferences: ${field} not provided, skipping`);
        continue;
      }
      const found = await load();
      if (!found) {
        this.logger.debug(`validateReferences: ${field}=${value} does not resolve for this tenant`);
        throw new NotFoundException(`${field} does not reference a valid record`);
      }
      this.logger.debug(`validateReferences: ${field}=${value} resolved OK`);
    }
  }

  findAll(mainStageId?: string): Promise<Deal[]> {
    return this.dealsRepo.findAllWithRelations(mainStageId);
  }

  async findOneOrFail(id: string): Promise<Deal> {
    const deal = await this.dealsRepo.findOneWithRelations(id);
    if (!deal) {
      throw new NotFoundException("Deal not found");
    }
    return deal;
  }

  // For mutation only, never for a response -- see the comment on
  // DealsRepository.findOneWithRelations for why saving a relations-loaded
  // Deal instance corrupts every relation-backed column on the row.
  private async findOneBareOrFail(id: string): Promise<Deal> {
    const deal = await this.dealsRepo.findOneScoped({ where: { id } });
    if (!deal) {
      throw new NotFoundException("Deal not found");
    }
    return deal;
  }

  // Used to warn the user how many Document/Note/Partner rows a Deal
  // deletion will cascade-delete, before they confirm. Deliberately not a
  // `dependentCount` field on DealResponse -- that response is fetched in
  // bulk for the whole Funnel board on every page load, and this count is
  // only ever relevant at the one moment someone opens the delete
  // confirmation.
  async countDependents(id: string): Promise<number> {
    await this.findOneBareOrFail(id);
    const [documents, notes, partners] = await Promise.all([
      this.dataSource.getRepository(DealDocument).count({ where: { dealId: id } }),
      this.dataSource.getRepository(DealNote).count({ where: { dealId: id } }),
      this.dataSource.getRepository(DealPartnersMap).count({ where: { dealId: id } }),
    ]);
    return documents + notes + partners;
  }

  async create(dto: CreateDealDto, userId: string): Promise<Deal> {
    this.logger.debug(`create called by ${userId} (name="${dto.name}")`);

    if (!dto.companyId && !dto.contactId) {
      this.logger.debug("Blocked: neither companyId nor contactId provided");
      throw new BadRequestException("Deal requires a customer: a companyId or a contactId");
    }

    await this.validateReferences(dto);

    try {
      const count = await this.dealsRepo.countAllScoped();
      const dealCode = `DEAL-${String(count + 1).padStart(5, "0")}`;
      this.logger.debug(`Assigned deal code ${dealCode}`);

      // createScoped() builds a plain new entity with no relations attached
      // (unlike the loaded-with-relations entities used for mutation
      // elsewhere in this service), so it isn't exposed to the save() bug
      // described above.
      const deal = this.dealsRepo.createScoped({
        ...dto,
        dealCode,
        status: DealStatus.Open,
        createdBy: userId,
      });
      await this.dealsRepo.saveScoped(deal);
      this.logger.debug(`create succeeded for deal ${deal.id}`);

      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: deal.id,
        action: "insert",
        actorId: userId,
        changes: { ...dto, dealCode },
      });

      return this.findOneOrFail(deal.id);
    } catch (err) {
      this.logger.error(`create failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async update(id: string, dto: UpdateDealDto, userId: string): Promise<Deal> {
    this.logger.debug(`update called for deal ${id} by ${userId}`);

    await this.validateReferences(dto);

    // Bare load for the actual mutation -- must not carry loaded relations
    // into saveScoped() (see findOneBareOrFail's comment).
    const deal = await this.findOneBareOrFail(id);

    const before: Record<string, unknown> = {};
    const dealAsRecord = deal as unknown as Record<string, unknown>;
    for (const key of Object.keys(dto)) {
      before[key] = dealAsRecord[key];
    }

    try {
      Object.assign(deal, dto, { updatedBy: userId });
      await this.dealsRepo.saveScoped(deal);
      // Re-fetch (with relations, for the response) rather than return the
      // in-memory object -- Object.assign copies omitted dto fields as
      // explicit `undefined`, which would misreport untouched columns as
      // missing in the API response.
      const updated = await this.findOneOrFail(id);
      this.logger.debug(`update succeeded for deal ${id}`);

      const changes: Record<string, { old: unknown; new: unknown }> = {};
      const updatedAsRecord = updated as unknown as Record<string, unknown>;
      for (const key of Object.keys(dto)) {
        const newValue = updatedAsRecord[key];
        if (before[key] !== newValue) {
          changes[key] = { old: before[key], new: newValue };
        }
      }
      if (Object.keys(changes).length > 0) {
        await this.auditLogService.record({
          entityType: AUDIT_ENTITY_TYPE,
          entityId: id,
          action: "update",
          actorId: userId,
          changes,
        });
      }

      return updated;
    } catch (err) {
      this.logger.error(`update failed for deal ${id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Cascades to the deal's own content -- Documents and Notes are
  // soft-deletable (each gets its own deletedBy, same two-step
  // softRemove()+update() pattern used everywhere else this session);
  // Partners map rows aren't soft-deletable (a bare join table, already
  // hard-deleted on its own removal path -- see deal-partners.service.ts)
  // so they're hard-deleted here too. Stage history is deliberately left
  // alone -- a permanent record of what happened, not content owned by the
  // deal, same "must survive the thing it references" reasoning as
  // audit_logs.
  async remove(id: string, userId: string): Promise<void> {
    const deal = await this.findOneBareOrFail(id);
    this.logger.debug(`remove called for deal ${id}`);
    try {
      await this.dataSource.transaction(async (manager) => {
        const documentRepo = manager.getRepository(DealDocument);
        const noteRepo = manager.getRepository(DealNote);
        const partnerRepo = manager.getRepository(DealPartnersMap);
        const dealRepo = manager.getRepository(Deal);

        const documents = await documentRepo.find({ where: { dealId: id } });
        if (documents.length > 0) {
          this.logger.debug(`Cascading soft-delete to ${documents.length} document(s)`);
          await documentRepo.softRemove(documents);
          await documentRepo.update(documents.map((doc) => doc.id), { deletedBy: userId });
        }

        const notes = await noteRepo.find({ where: { dealId: id } });
        if (notes.length > 0) {
          this.logger.debug(`Cascading soft-delete to ${notes.length} note(s)`);
          await noteRepo.softRemove(notes);
          await noteRepo.update(notes.map((note) => note.id), { deletedBy: userId });
        }

        const partners = await partnerRepo.find({ where: { dealId: id } });
        if (partners.length > 0) {
          this.logger.debug(`Cascading hard-delete to ${partners.length} partner link(s)`);
          await partnerRepo.remove(partners);
        }

        await dealRepo.softRemove(deal);
        await dealRepo.update(deal.id, { deletedBy: userId });
      });
      this.logger.debug(`remove succeeded for deal ${id}`);

      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: id,
        action: "delete",
        actorId: userId,
        changes: { name: deal.name, dealCode: deal.dealCode },
      });
    } catch (err) {
      this.logger.error(`remove failed for deal ${id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async moveStage(id: string, dto: MoveDealDto, userId: string): Promise<Deal> {
    // Bare load for the actual mutation -- same reasoning as update() above.
    const deal = await this.findOneBareOrFail(id);
    // Validates toStageId is a real Sub Stage belonging to the current
    // tenant, not just any UUID that happens to exist in sub_stages.
    const targetStage = await this.subStagesService.findOneOrFail(dto.toStageId);

    const fromStageId = deal.currentStageId;
    const fromMainStageId = deal.mainStageId;

    deal.currentStageId = targetStage.id;
    deal.mainStageId = targetStage.mainStageId;
    // A deal moved into a Won/Lost sub stage is recorded as such; moved back
    // out of one (into a stage with neither flag), it reverts to Open rather
    // than staying stuck.
    deal.status = targetStage.isWon
      ? DealStatus.Won
      : targetStage.isLost
        ? DealStatus.Lost
        : DealStatus.Open;
    deal.updatedBy = userId;
    await this.dealsRepo.saveScoped(deal);

    await this.stageHistoryService.recordSubStageMove({
      dealId: deal.id,
      fromStageId,
      toStageId: targetStage.id,
      movedById: userId,
      note: dto.note,
    });

    // Only log a Main Stage transition when the move actually crossed into
    // a different Main Stage -- most moves are within the same funnel stage.
    if (fromMainStageId !== targetStage.mainStageId) {
      await this.stageHistoryService.recordMainStageMove({
        dealId: deal.id,
        fromStageId: fromMainStageId,
        toStageId: targetStage.mainStageId,
        movedById: userId,
        note: dto.note,
      });
    }

    return this.findOneOrFail(id);
  }
}
