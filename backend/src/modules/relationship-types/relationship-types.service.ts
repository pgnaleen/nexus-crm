import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { CreateRelationshipTypeDto } from "./dto/create-relationship-type.dto";
import { UpdateRelationshipTypeDto } from "./dto/update-relationship-type.dto";
import { RelationshipCompanyContactMap } from "./entities/relationship-company-contact-map.entity";
import { RelationshipType } from "./entities/relationship-type.entity";
import { RelationshipPartiesRepository } from "./relationship-parties.repository";
import { RelationshipTypesRepository } from "./relationship-types.repository";

const AUDIT_ENTITY_TYPE = "relationship_type";

@Injectable()
export class RelationshipTypesService {
  private readonly logger = new Logger(RelationshipTypesService.name);

  constructor(
    private readonly relationshipTypesRepo: RelationshipTypesRepository,
    private readonly partiesRepo: RelationshipPartiesRepository,
    private readonly auditLogService: AuditLogService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<RelationshipType[]> {
    return this.relationshipTypesRepo.findScoped({ order: { name: "ASC" } });
  }

  // Bundles each type with its live dependent count in one extra grouped
  // query, instead of one count query per row.
  async findAllWithDependentCounts(): Promise<Array<{ type: RelationshipType; dependentCount: number }>> {
    const types = await this.findAll();
    const counts = await this.partiesRepo.countActiveGroupedByType(types.map((type) => type.id));
    return types.map((type) => ({ type, dependentCount: counts.get(type.id) ?? 0 }));
  }

  async findOneOrFail(id: string): Promise<RelationshipType> {
    const type = await this.relationshipTypesRepo.findOneScoped({ where: { id } });
    if (!type) {
      throw new NotFoundException("Relationship type not found");
    }
    return type;
  }

  countDependents(id: string): Promise<number> {
    return this.partiesRepo.countActiveForType(id);
  }

  async create(dto: CreateRelationshipTypeDto, userId: string): Promise<RelationshipType> {
    const type = this.relationshipTypesRepo.createScoped({ ...dto, createdBy: userId });
    const saved = await this.relationshipTypesRepo.saveScoped(type);
    await this.auditLogService.record({
      entityType: AUDIT_ENTITY_TYPE,
      entityId: saved.id,
      action: "insert",
      actorId: userId,
      changes: { name: saved.name },
    });
    return saved;
  }

  async update(id: string, dto: UpdateRelationshipTypeDto, userId: string): Promise<RelationshipType> {
    const type = await this.findOneOrFail(id);
    const before = { name: type.name };
    Object.assign(type, dto, { updatedBy: userId });
    await this.relationshipTypesRepo.saveScoped(type);
    // Re-fetch rather than return the in-memory object -- Object.assign copies
    // omitted dto fields as explicit `undefined`, which would misreport
    // untouched columns as missing in the API response (see rbac.service.ts).
    const updated = await this.findOneOrFail(id);

    const changes: Record<string, { old: unknown; new: unknown }> = {};
    if (before.name !== updated.name) {
      changes.name = { old: before.name, new: updated.name };
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
  }

  // Cascades to every tagged Company/Contact map row, per CLAUDE.md's
  // cascade-delete rule -- done explicitly here, in one transaction, rather
  // than relying on the map table's raw DB-level ON DELETE CASCADE (which
  // only fires on a hard DELETE and would never run for our soft-deletes).
  async remove(id: string, userId: string): Promise<void> {
    const type = await this.findOneOrFail(id);
    this.logger.debug(`remove called for relationship type ${id}`);
    let cascadedCount = 0;
    try {
      await this.dataSource.transaction(async (manager) => {
        const partyRepo = manager.getRepository(RelationshipCompanyContactMap);
        const typeRepo = manager.getRepository(RelationshipType);

        const dependents = await partyRepo.find({
          where: { relationshipTypeId: id, tenantId: type.tenantId },
        });
        cascadedCount = dependents.length;

        if (dependents.length > 0) {
          this.logger.debug(`Cascading soft-delete to ${dependents.length} tagged party row(s)`);
          await partyRepo.softRemove(dependents);
          await partyRepo.update(dependents.map((party) => party.id), { deletedBy: userId });
        } else {
          this.logger.debug("No tagged parties to cascade -- deleting the type alone");
        }

        await typeRepo.softRemove(type);
        await typeRepo.update(type.id, { deletedBy: userId });
      });
      this.logger.debug(`remove succeeded for relationship type ${id}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: id,
        action: "delete",
        actorId: userId,
        changes: { name: type.name, cascadedPartyCount: cascadedCount },
      });
    } catch (err) {
      this.logger.error(`remove failed for relationship type ${id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
