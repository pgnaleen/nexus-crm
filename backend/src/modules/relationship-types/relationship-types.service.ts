import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { SystemRole } from "@orelia/common";
import { DataSource } from "typeorm";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { Company } from "../companies/entities/company.entity";
import { Contact } from "../contacts/entities/contact.entity";
import { DealPartnersMap } from "../deals/entities/deal-partners-map.entity";
import { Deal } from "../deals/entities/deal.entity";
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

  // Resolves every row this tenant has flagged for a given system role --
  // used by the Deal Customer/Partner pickers to filter by id, never by
  // name, so renaming a flagged type never breaks the filter. Multiple
  // types may share the same role (e.g. "GTC Reseller" and "Technology
  // Partner" can both be flagged Partner), so the pickers union across all
  // of them.
  async findSystemRoleTypeIds(role: SystemRole): Promise<string[]> {
    this.logger.debug(`findSystemRoleTypeIds called for role=${role}`);
    const types = await this.relationshipTypesRepo.findScoped({ where: { systemRole: role } });
    this.logger.debug(`Resolved ${role} to ${types.length} relationship type(s)`);
    return types.map((type) => type.id);
  }

  async create(dto: CreateRelationshipTypeDto, userId: string): Promise<RelationshipType> {
    this.logger.debug(`create called by ${userId} (name="${dto.name}", systemRole=${dto.systemRole ?? "none"})`);
    try {
      const type = this.relationshipTypesRepo.createScoped({ ...dto, createdBy: userId });
      const saved = await this.relationshipTypesRepo.saveScoped(type);
      this.logger.debug(`create succeeded for relationship type ${saved.id}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: saved.id,
        action: "insert",
        actorId: userId,
        changes: { name: saved.name, systemRole: saved.systemRole ?? null },
      });
      return saved;
    } catch (err) {
      this.logger.error(`create failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async update(id: string, dto: UpdateRelationshipTypeDto, userId: string): Promise<RelationshipType> {
    this.logger.debug(`update called for relationship type ${id} by ${userId}`);
    const type = await this.findOneOrFail(id);

    const before: Record<string, unknown> = {};
    const typeAsRecord = type as unknown as Record<string, unknown>;
    for (const key of Object.keys(dto)) {
      before[key] = typeAsRecord[key];
    }

    try {
      Object.assign(type, dto, { updatedBy: userId });
      await this.relationshipTypesRepo.saveScoped(type);
      // Re-fetch rather than return the in-memory object -- Object.assign copies
      // omitted dto fields as explicit `undefined`, which would misreport
      // untouched columns as missing in the API response (see rbac.service.ts).
      const updated = await this.findOneOrFail(id);
      this.logger.debug(`update succeeded for relationship type ${id}`);

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
      this.logger.error(`update failed for relationship type ${id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Cascades to every tagged Company/Contact map row, AND the real
  // Company/Contact each one points at (plus a company's own owned
  // contacts) -- per CLAUDE.md's "cascade must reach the real leaf entity"
  // rule. Previously this only cascaded to the map row, leaving every
  // tagged Company/Contact fully active underneath. Done explicitly here,
  // in one transaction, rather than relying on the map table's raw DB-level
  // ON DELETE CASCADE (which only fires on a hard DELETE and would never
  // run for our soft-deletes). No special-casing for a flagged (systemRole)
  // row: deleting it just frees that role's slot, exactly like deleting any
  // other row.
  async remove(id: string, userId: string): Promise<void> {
    const type = await this.findOneOrFail(id);
    this.logger.debug(`remove called for relationship type ${id}`);

    const dependents = await this.partiesRepo.findScoped({ where: { relationshipTypeId: id } });
    this.logger.debug(`Found ${dependents.length} tagged part(y/ies) under this type`);

    // Blocked entirely (not partially cascaded) if any tagged Company/
    // Contact -- or a tagged company's own owned contacts -- is still
    // referenced by an active Deal, same "block, don't cascade past a live
    // reference" standard as MainStagesService.remove() and
    // RelationshipPartiesService.remove(). Checked before the try/catch
    // below so it isn't logged as an error, same as NotFoundException
    // elsewhere.
    const dealsRepo = this.dataSource.getRepository(Deal);
    const partnersRepo = this.dataSource.getRepository(DealPartnersMap);
    const contactsRepo = this.dataSource.getRepository(Contact);
    const companiesRepo = this.dataSource.getRepository(Company);

    const ownedContactsByCompany = new Map<string, Contact[]>();
    const blockers: string[] = [];

    for (const party of dependents) {
      if (party.companyId) {
        const [asCompany, asPartner] = await Promise.all([
          dealsRepo.count({ where: { companyId: party.companyId } }),
          partnersRepo.count({ where: { companyId: party.companyId } }),
        ]);
        if (asCompany + asPartner > 0) {
          const company = await companiesRepo.findOne({ where: { id: party.companyId } });
          blockers.push(`"${company?.name ?? party.companyId}" (${asCompany + asPartner} active deal reference(s))`);
        }
        const owned = await contactsRepo.find({ where: { companyId: party.companyId } });
        ownedContactsByCompany.set(party.companyId, owned);
        for (const contact of owned) {
          const [asContact, asPrimaryContact, asPartnerContact] = await Promise.all([
            dealsRepo.count({ where: { contactId: contact.id } }),
            dealsRepo.count({ where: { primaryContactId: contact.id } }),
            partnersRepo.count({ where: { contactId: contact.id } }),
          ]);
          if (asContact + asPrimaryContact + asPartnerContact > 0) {
            blockers.push(`"${contact.fullName}" (${asContact + asPrimaryContact + asPartnerContact} active deal reference(s))`);
          }
        }
      } else if (party.contactId) {
        const [asContact, asPrimaryContact, asPartnerContact] = await Promise.all([
          dealsRepo.count({ where: { contactId: party.contactId } }),
          dealsRepo.count({ where: { primaryContactId: party.contactId } }),
          partnersRepo.count({ where: { contactId: party.contactId } }),
        ]);
        if (asContact + asPrimaryContact + asPartnerContact > 0) {
          const contact = await contactsRepo.findOne({ where: { id: party.contactId } });
          blockers.push(`"${contact?.fullName ?? party.contactId}" (${asContact + asPrimaryContact + asPartnerContact} active deal reference(s))`);
        }
      }
    }

    if (blockers.length > 0) {
      this.logger.debug(`Blocked: ${blockers.length} tagged record(s) still referenced by active deals`);
      throw new ConflictException(
        `Cannot delete this relationship type: ${blockers.join(", ")} still referenced by active deal(s). Update those deals first.`,
      );
    }

    let cascadedPartyCount = 0;
    // Individual { entityType, entityId, name } records for each Company/
    // Contact actually cascaded -- collected inside the transaction, written
    // to audit_logs after it commits, so each deleted record gets its own
    // audit trail entry (not just a count folded into the type's own entry).
    const cascadedCompanies: Array<{ id: string; name: string | null }> = [];
    const cascadedContacts: Array<{ id: string; fullName: string | null; companyId: string | null }> = [];
    try {
      await this.dataSource.transaction(async (manager) => {
        const partyRepo = manager.getRepository(RelationshipCompanyContactMap);
        const typeRepo = manager.getRepository(RelationshipType);
        const companyRepoTx = manager.getRepository(Company);
        const contactRepoTx = manager.getRepository(Contact);

        cascadedPartyCount = dependents.length;
        if (dependents.length > 0) {
          this.logger.debug(`Cascading soft-delete to ${dependents.length} tagged party row(s)`);
          await partyRepo.softRemove(dependents);
          await partyRepo.update(dependents.map((party) => party.id), { deletedBy: userId });
        } else {
          this.logger.debug("No tagged parties to cascade -- deleting the type alone");
        }

        for (const party of dependents) {
          if (party.companyId) {
            const company = await companyRepoTx.findOne({ where: { id: party.companyId } });
            if (company) {
              await companyRepoTx.softRemove(company);
              await companyRepoTx.update(company.id, { deletedBy: userId });
              cascadedCompanies.push({ id: company.id, name: company.name });
            }
            const owned = ownedContactsByCompany.get(party.companyId) ?? [];
            if (owned.length > 0) {
              await contactRepoTx.softRemove(owned);
              await contactRepoTx.update(owned.map((c) => c.id), { deletedBy: userId });
              for (const contact of owned) {
                cascadedContacts.push({ id: contact.id, fullName: contact.fullName, companyId: party.companyId });
              }
            }
          } else if (party.contactId) {
            const contact = await contactRepoTx.findOne({ where: { id: party.contactId } });
            if (contact) {
              await contactRepoTx.softRemove(contact);
              await contactRepoTx.update(contact.id, { deletedBy: userId });
              cascadedContacts.push({ id: contact.id, fullName: contact.fullName, companyId: null });
            }
          }
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
        changes: {
          name: type.name,
          cascadedPartyCount,
          cascadedCompanyCount: cascadedCompanies.length,
          cascadedContactCount: cascadedContacts.length,
        },
      });
      for (const company of cascadedCompanies) {
        await this.auditLogService.record({
          entityType: "company",
          entityId: company.id,
          action: "delete",
          actorId: userId,
          changes: { name: company.name, cascadeReason: `relationship type "${type.name}" deleted` },
        });
      }
      for (const contact of cascadedContacts) {
        await this.auditLogService.record({
          entityType: "contact",
          entityId: contact.id,
          action: "delete",
          actorId: userId,
          changes: { fullName: contact.fullName, companyId: contact.companyId, cascadeReason: `relationship type "${type.name}" deleted` },
        });
      }
    } catch (err) {
      this.logger.error(`remove failed for relationship type ${id}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
