import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { TenantContextService } from "../../core/tenant";
import { CompaniesRepository } from "../companies/companies.repository";
import { Company } from "../companies/entities/company.entity";
import { ContactsRepository } from "../contacts/contacts.repository";
import { Contact } from "../contacts/entities/contact.entity";
import { CreateRelationshipPartyCompanyDto } from "./dto/create-relationship-party-company.dto";
import { CreateRelationshipPartyContactDto } from "./dto/create-relationship-party-contact.dto";
import { UpdateRelationshipPartyCompanyDto } from "./dto/update-relationship-party-company.dto";
import { UpdateRelationshipPartyContactDto } from "./dto/update-relationship-party-contact.dto";
import { RelationshipCompanyContactMap } from "./entities/relationship-company-contact-map.entity";
import { RelationshipPartiesRepository } from "./relationship-parties.repository";
import { RelationshipTypesService } from "./relationship-types.service";

@Injectable()
export class RelationshipPartiesService {
  private readonly logger = new Logger(RelationshipPartiesService.name);

  constructor(
    private readonly partiesRepo: RelationshipPartiesRepository,
    private readonly companiesRepo: CompaniesRepository,
    private readonly contactsRepo: ContactsRepository,
    private readonly relationshipTypesService: RelationshipTypesService,
    private readonly tenantContext: TenantContextService,
    private readonly auditLogService: AuditLogService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findAllForType(relationshipTypeId: string): Promise<RelationshipCompanyContactMap[]> {
    this.logger.debug(`findAllForType called for relationship type ${relationshipTypeId}`);
    await this.relationshipTypesService.findOneOrFail(relationshipTypeId);
    const results = await this.partiesRepo.findScoped({
      where: { relationshipTypeId },
      relations: ["company", "contact"],
      order: { createdAt: "DESC" },
    });
    this.logger.debug(`findAllForType returning ${results.length} row(s)`);
    return results;
  }

  async findOneOrFail(relationshipTypeId: string, mapId: string): Promise<RelationshipCompanyContactMap> {
    const party = await this.partiesRepo.findOneScoped({
      where: { id: mapId, relationshipTypeId },
      relations: ["company", "contact"],
    });
    if (!party) {
      throw new NotFoundException("Relationship party not found");
    }
    return party;
  }

  async addCompany(
    relationshipTypeId: string,
    dto: CreateRelationshipPartyCompanyDto,
    userId: string,
  ): Promise<RelationshipCompanyContactMap> {
    this.logger.debug(`addCompany called for relationship type ${relationshipTypeId} by ${userId} (name="${dto.name}")`);
    await this.relationshipTypesService.findOneOrFail(relationshipTypeId);
    const tenantId = this.tenantContext.getTenantId();
    const { contacts, ...companyFields } = dto;

    try {
      // The company and every inline contact must land together or not at
      // all -- without this, a failure partway through (e.g. the 2nd of 3
      // contacts) would leave a company with only some of its people attached,
      // silently. Plain repositories bound to the transactional manager here
      // (not the tenant-scoped createScoped/saveScoped helpers, which operate
      // outside the transaction) -- tenantId is set explicitly instead, which
      // is safe since it comes from the trusted request context, not the body.
      const { companyPartyId, savedCompanyId, savedContactIds } = await this.dataSource.transaction(async (manager) => {
        const companyRepo = manager.getRepository(Company);
        const contactRepo = manager.getRepository(Contact);
        const partyRepo = manager.getRepository(RelationshipCompanyContactMap);

        const company = companyRepo.create({ ...companyFields, tenantId, createdBy: userId });
        const savedCompany = await companyRepo.save(company);

        const companyParty = partyRepo.create({
          relationshipTypeId,
          companyId: savedCompany.id,
          tenantId,
          createdBy: userId,
        });
        const savedCompanyParty = await partyRepo.save(companyParty);

        const contactIds: string[] = [];
        for (const contactDto of contacts ?? []) {
          const contact = contactRepo.create({
            ...contactDto,
            companyId: savedCompany.id,
            tenantId,
            createdBy: userId,
          });
          const savedContact = await contactRepo.save(contact);
          contactIds.push(savedContact.id);

          const contactParty = partyRepo.create({
            relationshipTypeId,
            contactId: savedContact.id,
            tenantId,
            createdBy: userId,
          });
          await partyRepo.save(contactParty);
        }

        return { companyPartyId: savedCompanyParty.id, savedCompanyId: savedCompany.id, savedContactIds: contactIds };
      });
      this.logger.debug(`addCompany succeeded, company ${savedCompanyId} with ${savedContactIds.length} contact(s)`);

      await this.auditLogService.record({
        entityType: "company",
        entityId: savedCompanyId,
        action: "insert",
        actorId: userId,
        changes: { relationshipTypeId, ...companyFields },
      });
      for (const contactId of savedContactIds) {
        await this.auditLogService.record({
          entityType: "contact",
          entityId: contactId,
          action: "insert",
          actorId: userId,
          changes: { relationshipTypeId, companyId: savedCompanyId },
        });
      }

      return this.findOneOrFail(relationshipTypeId, companyPartyId);
    } catch (err) {
      this.logger.error(`addCompany failed for relationship type ${relationshipTypeId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async addContact(
    relationshipTypeId: string,
    dto: CreateRelationshipPartyContactDto,
    userId: string,
  ): Promise<RelationshipCompanyContactMap> {
    this.logger.debug(`addContact called for relationship type ${relationshipTypeId} by ${userId} (fullName="${dto.fullName}")`);
    await this.relationshipTypesService.findOneOrFail(relationshipTypeId);
    try {
      const contact = this.contactsRepo.createScoped({ ...dto, createdBy: userId });
      const savedContact = await this.contactsRepo.saveScoped(contact);

      const party = this.partiesRepo.createScoped({
        relationshipTypeId,
        contactId: savedContact.id,
        createdBy: userId,
      });
      const savedParty = await this.partiesRepo.saveScoped(party);
      this.logger.debug(`addContact succeeded, contact ${savedContact.id}`);

      await this.auditLogService.record({
        entityType: "contact",
        entityId: savedContact.id,
        action: "insert",
        actorId: userId,
        changes: { relationshipTypeId, ...dto },
      });

      return this.findOneOrFail(relationshipTypeId, savedParty.id);
    } catch (err) {
      this.logger.error(`addContact failed for relationship type ${relationshipTypeId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async updateCompany(
    relationshipTypeId: string,
    mapId: string,
    dto: UpdateRelationshipPartyCompanyDto,
    userId: string,
  ): Promise<RelationshipCompanyContactMap> {
    this.logger.debug(`updateCompany called for party ${mapId} on relationship type ${relationshipTypeId} by ${userId}`);
    const party = await this.findOneOrFail(relationshipTypeId, mapId);
    if (!party.companyId) {
      this.logger.debug(`Blocked: party ${mapId} is not a company`);
      throw new BadRequestException("This relationship party is not a company");
    }
    const company = await this.companiesRepo.findOneScoped({ where: { id: party.companyId } });
    if (!company) {
      throw new NotFoundException("Company not found");
    }

    const before: Record<string, unknown> = {};
    const companyAsRecord = company as unknown as Record<string, unknown>;
    for (const key of Object.keys(dto)) {
      before[key] = companyAsRecord[key];
    }

    try {
      Object.assign(company, dto, { updatedBy: userId });
      await this.companiesRepo.saveScoped(company);
      this.logger.debug(`updateCompany succeeded for company ${company.id}`);

      const changes: Record<string, { old: unknown; new: unknown }> = {};
      const companyAfterAsRecord = company as unknown as Record<string, unknown>;
      for (const key of Object.keys(dto)) {
        const newValue = companyAfterAsRecord[key];
        if (before[key] !== newValue) {
          changes[key] = { old: before[key], new: newValue };
        }
      }
      if (Object.keys(changes).length > 0) {
        await this.auditLogService.record({
          entityType: "company",
          entityId: company.id,
          action: "update",
          actorId: userId,
          changes,
        });
      }

      // Re-fetch rather than trust the in-memory object -- Object.assign copies
      // omitted dto fields as explicit `undefined`, which would misreport
      // untouched columns as missing in the API response.
      return this.findOneOrFail(relationshipTypeId, mapId);
    } catch (err) {
      this.logger.error(`updateCompany failed for party ${mapId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async updateContact(
    relationshipTypeId: string,
    mapId: string,
    dto: UpdateRelationshipPartyContactDto,
    userId: string,
  ): Promise<RelationshipCompanyContactMap> {
    this.logger.debug(`updateContact called for party ${mapId} on relationship type ${relationshipTypeId} by ${userId}`);
    const party = await this.findOneOrFail(relationshipTypeId, mapId);
    if (!party.contactId) {
      this.logger.debug(`Blocked: party ${mapId} is not a person`);
      throw new BadRequestException("This relationship party is not a person");
    }
    const contact = await this.contactsRepo.findOneScoped({ where: { id: party.contactId } });
    if (!contact) {
      throw new NotFoundException("Contact not found");
    }

    const before: Record<string, unknown> = {};
    const contactAsRecord = contact as unknown as Record<string, unknown>;
    for (const key of Object.keys(dto)) {
      before[key] = contactAsRecord[key];
    }

    try {
      Object.assign(contact, dto, { updatedBy: userId });
      await this.contactsRepo.saveScoped(contact);
      this.logger.debug(`updateContact succeeded for contact ${contact.id}`);

      const changes: Record<string, { old: unknown; new: unknown }> = {};
      const contactAfterAsRecord = contact as unknown as Record<string, unknown>;
      for (const key of Object.keys(dto)) {
        const newValue = contactAfterAsRecord[key];
        if (before[key] !== newValue) {
          changes[key] = { old: before[key], new: newValue };
        }
      }
      if (Object.keys(changes).length > 0) {
        await this.auditLogService.record({
          entityType: "contact",
          entityId: contact.id,
          action: "update",
          actorId: userId,
          changes,
        });
      }

      return this.findOneOrFail(relationshipTypeId, mapId);
    } catch (err) {
      this.logger.error(`updateContact failed for party ${mapId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async setActive(
    relationshipTypeId: string,
    mapId: string,
    isActive: boolean,
    userId: string,
  ): Promise<RelationshipCompanyContactMap> {
    this.logger.debug(`setActive called for party ${mapId} on relationship type ${relationshipTypeId} by ${userId} (isActive=${isActive})`);
    const party = await this.findOneOrFail(relationshipTypeId, mapId);
    const before = party.isActive;
    try {
      party.isActive = isActive;
      party.updatedBy = userId;
      await this.partiesRepo.saveScoped(party);
      this.logger.debug(`setActive succeeded for party ${mapId}`);

      if (before !== isActive) {
        await this.auditLogService.record({
          entityType: "relationship_party",
          entityId: mapId,
          action: "update",
          actorId: userId,
          changes: { isActive: { old: before, new: isActive } },
        });
      }

      return this.findOneOrFail(relationshipTypeId, mapId);
    } catch (err) {
      this.logger.error(`setActive failed for party ${mapId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async remove(relationshipTypeId: string, mapId: string, userId: string): Promise<void> {
    this.logger.debug(`remove called for party ${mapId} on relationship type ${relationshipTypeId} by ${userId}`);
    const party = await this.findOneOrFail(relationshipTypeId, mapId);
    try {
      await this.partiesRepo.softRemoveScoped(party, userId);
      this.logger.debug(`remove succeeded for party ${mapId}`);
      await this.auditLogService.record({
        entityType: "relationship_party",
        entityId: mapId,
        action: "delete",
        actorId: userId,
        changes: { relationshipTypeId, companyId: party.companyId ?? null, contactId: party.contactId ?? null },
      });
    } catch (err) {
      this.logger.error(`remove failed for party ${mapId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
