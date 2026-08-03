import { DealStatus, DocumentOwnerType, UserStatus } from "@orelia/common";
import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { TenantContextService } from "../../core/tenant";
import { CompaniesRepository } from "../companies/companies.repository";
import { ContactsRepository } from "../contacts/contacts.repository";
import { DealSourcesRepository } from "../deal-sources/deal-sources.repository";
import { MainStagesService } from "../deal-stages/main-stages.service";
import { SubStagesService } from "../deal-stages/sub-stages.service";
import { DepartmentsRepository } from "../departments/departments.repository";
import { Document } from "../documents/entities/document.entity";
import { User } from "../users/entities/user.entity";
import { CreateDealDto } from "./dto/create-deal.dto";
import { MoveDealDto } from "./dto/move-deal.dto";
import { UpdateDealDto } from "./dto/update-deal.dto";
import { Deal } from "./entities/deal.entity";
import { DealNote } from "./entities/deal-note.entity";
import { DealPartnersMap } from "./entities/deal-partners-map.entity";
import { DealRole } from "./entities/deal-role.entity";
import { DealRoleAssignment } from "./entities/deal-role-assignment.entity";
import { DealStageHistoryService } from "./deal-stage-history.service";
import { DealsRepository } from "./deals.repository";

const AUDIT_ENTITY_TYPE = "deal";

@Injectable()
export class DealsService {
  private readonly logger = new Logger(DealsService.name);

  constructor(
    private readonly dealsRepo: DealsRepository,
    private readonly subStagesService: SubStagesService,
    private readonly mainStagesService: MainStagesService,
    private readonly stageHistoryService: DealStageHistoryService,
    private readonly auditLogService: AuditLogService,
    private readonly companiesRepo: CompaniesRepository,
    private readonly contactsRepo: ContactsRepository,
    private readonly dealSourcesRepo: DealSourcesRepository,
    private readonly departmentsRepo: DepartmentsRepository,
    private readonly tenantContext: TenantContextService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // Every FK below is a raw id with no tenant-scoped join, so an id
  // belonging to another tenant (or a soft-deleted row) would otherwise be
  // accepted silently and then resolved back into the response via
  // findOneWithRelations's leftJoinAndSelects -- leaking that other
  // tenant's company/contact/department/source name. Only checks fields
  // actually present on the given dto, so it works for both the create dto
  // and the update dto (all optional). salesPersonUserId is validated
  // separately in create() -- it needs a tenant + active-user check, not a
  // plain findOneScoped against one of these repos.
  private async validateReferences(
    dto: Partial<CreateDealDto> | Partial<UpdateDealDto>,
  ): Promise<void> {
    const checks: Array<[string, string | undefined, () => Promise<unknown>]> = [
      ["mainStageId", dto.mainStageId, () =>
        this.mainStagesService.findOneOrFail(dto.mainStageId as string).catch(() => null)],
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

  // Naming-only lookup (S3 folder naming for deal documents) -- public,
  // unlike findOneBareOrFail below, since DealDocumentsService needs it and
  // deliberately doesn't hold its own DealsRepository.
  async findBasicOrFail(id: string): Promise<Pick<Deal, "id" | "dealCode" | "name">> {
    const deal = await this.dealsRepo.findBasicScoped(id);
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
      this.dataSource
        .getRepository(Document)
        .count({ where: { ownerType: DocumentOwnerType.DealDocument, ownerId: id } }),
      this.dataSource.getRepository(DealNote).count({ where: { dealId: id } }),
      this.dataSource.getRepository(DealPartnersMap).count({ where: { dealId: id } }),
    ]);
    return documents + notes + partners;
  }

  async create(dto: CreateDealDto, userId: string): Promise<Deal> {
    this.logger.debug(`create called by ${userId} (name="${dto.name}")`);

    await this.validateReferences(dto);

    const tenantId = this.tenantContext.getTenantId();

    // salesPersonUserId is a User id, not an Employee id (see
    // DealRoleAssignment's own comment) -- validated here rather than in
    // validateReferences() since it needs an active-status check too, not
    // just existence.
    const salesPersonUser = await this.dataSource.getRepository(User).findOne({
      where: { id: dto.salesPersonUserId, tenantId, status: UserStatus.Active },
    });
    if (!salesPersonUser) {
      this.logger.debug(`create: salesPersonUserId=${dto.salesPersonUserId} does not resolve to an active user for this tenant`);
      throw new NotFoundException("salesPersonUserId does not reference a valid record");
    }

    // Every tenant is seeded with exactly one requires-primary-on-create
    // role ("Sales Person") -- see SeedDealRolesAndBackfillAssignments and
    // TenantsService.create(). Not finding one is a provisioning bug, not a
    // caller error.
    const salesPersonRole = await this.dataSource.getRepository(DealRole).findOne({
      where: { tenantId, requiresPrimaryOnCreate: true },
    });
    if (!salesPersonRole) {
      this.logger.error(`create: no requires-primary-on-create deal role configured for tenant ${tenantId}`);
      throw new Error("No Sales Person role configured for this tenant");
    }

    const { salesPersonUserId, ...dealFields } = dto;

    // dealCode is derived from a plain count with no lock, so two concurrent
    // creates in the same tenant can race for the same code. The DB has a
    // unique (tenant_id, deal_code) index to catch that if it happens; on a
    // collision (Postgres 23505), just recompute the count and retry rather
    // than letting a duplicate through or failing the request outright.
    const MAX_DEAL_CODE_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_DEAL_CODE_ATTEMPTS; attempt++) {
      try {
        const count = await this.dealsRepo.countAllScoped();
        const dealCode = `DEAL-${String(count + 1).padStart(5, "0")}`;
        this.logger.debug(`Assigned deal code ${dealCode} (attempt ${attempt})`);

        // The deal row and its mandatory primary Sales Person assignment are
        // inserted together in one transaction -- a deal must never exist
        // even momentarily with no primary Sales Person.
        const dealId = await this.dataSource.transaction(async (manager) => {
          const dealRepo = manager.getRepository(Deal);
          const assignmentRepo = manager.getRepository(DealRoleAssignment);

          const deal = dealRepo.create({
            ...dealFields,
            tenantId,
            dealCode,
            status: DealStatus.Open,
            createdBy: userId,
          });
          await dealRepo.save(deal);

          await assignmentRepo.save(
            assignmentRepo.create({
              dealId: deal.id,
              roleId: salesPersonRole.id,
              userId: salesPersonUserId,
              isPrimary: true,
              createdById: userId,
            }),
          );

          return deal.id;
        });
        this.logger.debug(`create succeeded for deal ${dealId}`);

        await this.auditLogService.record({
          entityType: AUDIT_ENTITY_TYPE,
          entityId: dealId,
          action: "insert",
          actorId: userId,
          changes: { ...dto, dealCode },
        });

        return await this.findOneOrFail(dealId);
      } catch (err) {
        const isDealCodeConflict = (err as { code?: string; driverError?: { code?: string } }).code === "23505"
          || (err as { code?: string; driverError?: { code?: string } }).driverError?.code === "23505";
        if (isDealCodeConflict && attempt < MAX_DEAL_CODE_ATTEMPTS) {
          this.logger.debug(`Deal code conflict on attempt ${attempt}, retrying`);
          continue;
        }
        this.logger.error(`create failed: ${(err as Error).message}`, (err as Error).stack);
        throw err;
      }
    }
    // Unreachable -- the loop above always either returns or throws.
    throw new Error("create failed: exhausted deal code retry attempts");
  }

  async update(id: string, dto: UpdateDealDto, userId: string): Promise<Deal> {
    this.logger.debug(`update called for deal ${id} by ${userId}`);

    await this.validateReferences(dto);

    // Bare load for the actual mutation -- must not carry loaded relations
    // into saveScoped() (see findOneBareOrFail's comment).
    const deal = await this.findOneBareOrFail(id);

    // A deal's customer is a company or a bare contact, never both -- track
    // both FKs regardless of which one the caller sent, since clearing the
    // other one below (mutual exclusivity) is a real side effect that must
    // still show up in the audit diff even when the dto itself never
    // mentions it.
    const trackedKeys = new Set(Object.keys(dto));
    trackedKeys.add("companyId");
    trackedKeys.add("contactId");

    const before: Record<string, unknown> = {};
    const dealAsRecord = deal as unknown as Record<string, unknown>;
    for (const key of trackedKeys) {
      before[key] = dealAsRecord[key];
    }

    try {
      if (dto.companyId && dto.contactId) {
        throw new BadRequestException("companyId and contactId cannot both be set");
      }
      if (dto.companyId) {
        this.logger.debug(`update: companyId set to ${dto.companyId}, clearing contactId (mutual exclusivity)`);
        deal.contactId = null;
      } else if (dto.contactId) {
        this.logger.debug(`update: contactId set to ${dto.contactId}, clearing companyId (mutual exclusivity)`);
        deal.companyId = null;
      } else {
        this.logger.debug("update: no customer change requested");
      }

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
      for (const key of trackedKeys) {
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
        const documentRepo = manager.getRepository(Document);
        const noteRepo = manager.getRepository(DealNote);
        const partnerRepo = manager.getRepository(DealPartnersMap);
        const dealRepo = manager.getRepository(Deal);

        const documents = await documentRepo.find({
          where: { ownerType: DocumentOwnerType.DealDocument, ownerId: id },
        });
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
    this.logger.debug(
      `moveStage called for deal ${id} by ${userId} (toStageId=${dto.toStageId ?? "none"}, toMainStageId=${dto.toMainStageId ?? "none"})`,
    );
    try {
      if (!dto.toStageId && !dto.toMainStageId) {
        this.logger.debug("Blocked: neither toStageId nor toMainStageId provided");
        throw new BadRequestException("Move requires a target: a toStageId or a toMainStageId");
      }
      if (dto.toStageId && dto.toMainStageId) {
        this.logger.debug("Blocked: both toStageId and toMainStageId provided");
        throw new BadRequestException("Move requires exactly one target, not both toStageId and toMainStageId");
      }

      // Bare load for the actual mutation -- same reasoning as update() above.
      const deal = await this.findOneBareOrFail(id);

      const fromStatus = deal.status;
      const fromStageId = deal.currentStageId;
      const fromMainStageId = deal.mainStageId;

      let newMainStageId: string;
      let newCurrentStageId: string | undefined;
      let isWon: boolean;
      let isLost: boolean;

      if (dto.toStageId) {
        // Validates toStageId is a real Sub Stage belonging to the current
        // tenant, not just any UUID that happens to exist in sub_stages.
        const targetStage = await this.subStagesService.findOneOrFail(dto.toStageId);
        newMainStageId = targetStage.mainStageId;
        newCurrentStageId = targetStage.id;
        isWon = targetStage.isWon;
        isLost = targetStage.isLost;
      } else {
        // Validates toMainStageId the same way, for the Main-Stage-only move
        // (no Sub Stage involved at all).
        const targetMainStage = await this.mainStagesService.findOneOrFail(dto.toMainStageId as string);
        newMainStageId = targetMainStage.id;
        newCurrentStageId = undefined;
        isWon = targetMainStage.isWon;
        isLost = targetMainStage.isLost;
      }

      deal.currentStageId = newCurrentStageId;
      deal.mainStageId = newMainStageId;
      // A deal moved into a Won/Lost stage (Sub or Main) is recorded as such;
      // moved back out of one (into a stage with neither flag), it reverts to
      // Open rather than staying stuck.
      if (isWon) {
        this.logger.debug(`Target stage is a Won stage -- setting status to won`);
        deal.status = DealStatus.Won;
      } else if (isLost) {
        this.logger.debug(`Target stage is a Lost stage -- setting status to lost`);
        deal.status = DealStatus.Lost;
      } else {
        this.logger.debug(`Target stage is neither Won nor Lost -- status is open`);
        deal.status = DealStatus.Open;
      }
      deal.updatedBy = userId;
      await this.dealsRepo.saveScoped(deal);

      // Only write a Sub Stage history row when a Sub Stage was actually
      // involved on either side -- a pure Main-Stage-to-Main-Stage move where
      // the deal was already (and stays) stage-less has no Sub Stage change
      // to record.
      if (fromStageId || newCurrentStageId) {
        await this.stageHistoryService.recordSubStageMove({
          dealId: deal.id,
          fromStageId,
          toStageId: newCurrentStageId,
          movedById: userId,
          note: dto.note,
        });
      } else {
        this.logger.debug("No Sub Stage involved on either side of this move, skipping Sub Stage history");
      }

      // Only log a Main Stage transition when the move actually crossed into
      // a different Main Stage -- most moves are within the same funnel stage.
      const crossedMainStage = fromMainStageId !== newMainStageId;
      if (crossedMainStage) {
        this.logger.debug(`Move crossed from Main Stage ${fromMainStageId} to ${newMainStageId}`);
        await this.stageHistoryService.recordMainStageMove({
          dealId: deal.id,
          fromStageId: fromMainStageId,
          toStageId: newMainStageId,
          movedById: userId,
          note: dto.note,
        });
      } else {
        this.logger.debug("Move stayed within the same Main Stage, no Main Stage history row needed");
      }

      if (fromStatus !== deal.status) {
        await this.auditLogService.record({
          entityType: AUDIT_ENTITY_TYPE,
          entityId: id,
          action: "update",
          actorId: userId,
          changes: { status: { old: fromStatus, new: deal.status } },
        });
      }

      this.logger.debug(`moveStage succeeded for deal ${id}`);
      return await this.findOneOrFail(id);
    } catch (err) {
      this.logger.error(`moveStage failed for deal ${id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
