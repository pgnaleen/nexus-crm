import { DocumentOwnerType } from "@orelia/common";
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { assertKeyBelongsToTenant, LOGO_SEGMENT } from "../../core/storage/storage.constants";
import { TenantContextService } from "../../core/tenant";
import { CompaniesRepository } from "../companies/companies.repository";
import { Company } from "../companies/entities/company.entity";
import { ContactsRepository } from "../contacts/contacts.repository";
import { Contact } from "../contacts/entities/contact.entity";
import { DealPartnersMap } from "../deals/entities/deal-partners-map.entity";
import { Deal } from "../deals/entities/deal.entity";
import { DocumentsService } from "../documents/documents.service";
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
    private readonly documentsService: DocumentsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findAllForType(relationshipTypeId: string): Promise<RelationshipCompanyContactMap[]> {
    this.logger.debug(`findAllForType called for relationship type ${relationshipTypeId}`);
    await this.relationshipTypesService.findOneOrFail(relationshipTypeId);
    const results = await this.partiesRepo.findScoped({
      where: { relationshipTypeId },
      // company.territoryOwner is loaded read-only for display (its resolved
      // name). The mutation path (updateCompany) re-loads the company bare, so
      // this relation load never reaches a save() -- see the TypeORM
      // "never save an entity loaded with relations" rule in CLAUDE.md.
      relations: ["company", "company.territoryOwner", "contact"],
      order: { createdAt: "DESC" },
    });
    this.logger.debug(`findAllForType returning ${results.length} row(s)`);
    return results;
  }

  async findOneOrFail(relationshipTypeId: string, mapId: string): Promise<RelationshipCompanyContactMap> {
    const party = await this.partiesRepo.findOneScoped({
      where: { id: mapId, relationshipTypeId },
      // company.territoryOwner loaded read-only for display -- see findAllForType.
      // Deliberately NOT loading "relationshipType" here even though this
      // method is display-only for most callers -- found in a second review
      // pass: setActive() (below) also calls this method, then saveScoped()s
      // the same object, so adding relations here would widen exactly the
      // "save an entity loaded with relations" surface CLAUDE.md's TypeORM
      // rule warns about, on a NOT NULL column this time. linkExisting*ToType
      // attaches relationshipType manually from an object it already fetched
      // instead of relying on this method loading it.
      relations: ["company", "company.territoryOwner", "contact"],
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
    const { contacts, logo, ...companyFields } = dto;
    if (logo) {
      assertKeyBelongsToTenant(logo, LOGO_SEGMENT, this.tenantContext.getTenantSlug());
    }

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
          // Company-owned contacts (an employee/contact-person at this
          // company) do NOT get their own relationship_company_contact_map
          // row -- they're already covered by the company's own party row
          // via their companyId. Giving them an independent row made them
          // indistinguishable from a standalone party directly and
          // independently tagged with this relationship type, which
          // double-counted them in findAllForType/the dependent-count
          // queries (bug fixed 2026-07-22).
          const contact = contactRepo.create({
            ...contactDto,
            companyId: savedCompany.id,
            tenantId,
            createdBy: userId,
          });
          const savedContact = await contactRepo.save(contact);
          contactIds.push(savedContact.id);
        }

        return { companyPartyId: savedCompanyParty.id, savedCompanyId: savedCompany.id, savedContactIds: contactIds };
      });
      this.logger.debug(`addCompany succeeded, company ${savedCompanyId} with ${savedContactIds.length} contact(s)`);

      if (logo) {
        await this.documentsService.replaceSingle(DocumentOwnerType.CompanyLogo, savedCompanyId, logo, userId);
      }

      await this.auditLogService.record({
        entityType: "company",
        entityId: savedCompanyId,
        action: "insert",
        actorId: userId,
        changes: { relationshipTypeId, ...companyFields, logo },
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
  ): Promise<{ party: RelationshipCompanyContactMap | null; contact: Contact }> {
    this.logger.debug(`addContact called for relationship type ${relationshipTypeId} by ${userId} (fullName="${dto.fullName}", companyId=${dto.companyId ?? "none"})`);
    await this.relationshipTypesService.findOneOrFail(relationshipTypeId);
    try {
      const contact = this.contactsRepo.createScoped({ ...dto, createdBy: userId });
      const savedContact = await this.contactsRepo.saveScoped(contact);

      await this.auditLogService.record({
        entityType: "contact",
        entityId: savedContact.id,
        action: "insert",
        actorId: userId,
        changes: { relationshipTypeId, ...dto },
      });

      if (dto.companyId) {
        // Company-owned contact -- already covered by the company's own
        // party row, so it must NOT get an independent one of its own (see
        // the same reasoning in addCompany's inline-contacts loop above).
        this.logger.debug(`addContact: contact ${savedContact.id} belongs to company ${dto.companyId}, skipping standalone party row`);
        return { party: null, contact: savedContact };
      }

      const party = this.partiesRepo.createScoped({
        relationshipTypeId,
        contactId: savedContact.id,
        createdBy: userId,
      });
      const savedParty = await this.partiesRepo.saveScoped(party);
      this.logger.debug(`addContact succeeded, standalone contact ${savedContact.id}`);

      return { party: await this.findOneOrFail(relationshipTypeId, savedParty.id), contact: savedContact };
    } catch (err) {
      this.logger.error(`addContact failed for relationship type ${relationshipTypeId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async listContactsForCompany(relationshipTypeId: string, mapId: string): Promise<Contact[]> {
    this.logger.debug(`listContactsForCompany called for party ${mapId} on relationship type ${relationshipTypeId}`);
    const party = await this.findOneOrFail(relationshipTypeId, mapId);
    if (!party.companyId) {
      this.logger.debug(`Blocked: party ${mapId} is not a company`);
      throw new BadRequestException("This relationship party is not a company");
    }
    const contacts = await this.contactsRepo.findScoped({
      where: { companyId: party.companyId },
      order: { fullName: "ASC" },
    });
    this.logger.debug(`listContactsForCompany returning ${contacts.length} row(s) for company ${party.companyId}`);
    return contacts;
  }

  // Company-owned contacts have no relationship_company_contact_map row of
  // their own (see addCompany/addContact above), so unlike updateContact/
  // remove below -- which are keyed by a party's mapId -- these two methods
  // resolve mapId -> party.companyId first, then scope the Contact lookup to
  // { id: contactId, companyId: party.companyId }. That companyId check is
  // what stops someone from touching a contact via the wrong company's mapId.
  async updateContactForCompany(
    relationshipTypeId: string,
    mapId: string,
    contactId: string,
    dto: UpdateRelationshipPartyContactDto,
    userId: string,
  ): Promise<Contact> {
    this.logger.debug(`updateContactForCompany called for contact ${contactId} under company party ${mapId} on relationship type ${relationshipTypeId} by ${userId}`);
    const party = await this.findOneOrFail(relationshipTypeId, mapId);
    if (!party.companyId) {
      this.logger.debug(`Blocked: party ${mapId} is not a company`);
      throw new BadRequestException("This relationship party is not a company");
    }
    const contact = await this.contactsRepo.findOneScoped({ where: { id: contactId, companyId: party.companyId } });
    if (!contact) {
      throw new NotFoundException("Contact not found for this company");
    }

    const before: Record<string, unknown> = {};
    const contactAsRecord = contact as unknown as Record<string, unknown>;
    for (const key of Object.keys(dto)) {
      before[key] = contactAsRecord[key];
    }

    try {
      Object.assign(contact, dto, { updatedBy: userId });
      await this.contactsRepo.saveScoped(contact);
      this.logger.debug(`updateContactForCompany succeeded for contact ${contact.id}`);

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

      const updated = await this.contactsRepo.findOneScoped({ where: { id: contactId } });
      if (!updated) {
        throw new NotFoundException("Contact not found after update");
      }
      return updated;
    } catch (err) {
      this.logger.error(`updateContactForCompany failed for contact ${contactId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Deal.contactId/primaryContactId have DB-level ON DELETE SET NULL, and
  // deal_partners_map.contactId has ON DELETE CASCADE, but neither fires on
  // a soft-delete. Without this check, deleting a company-owned contact who
  // is a deal's Customer/primary contact or a Partner would leave that deal
  // silently pointing at (or, for the partner map, quietly losing) a
  // now-hidden, soft-deleted Contact.
  async countActiveDeals(contactId: string): Promise<{ asContact: number; asPrimaryContact: number; asPartner: number }> {
    const dealsRepo = this.dataSource.getRepository(Deal);
    const partnersRepo = this.dataSource.getRepository(DealPartnersMap);
    const [asContact, asPrimaryContact, asPartner] = await Promise.all([
      dealsRepo.count({ where: { contactId } }),
      dealsRepo.count({ where: { primaryContactId: contactId } }),
      partnersRepo.count({ where: { contactId } }),
    ]);
    return { asContact, asPrimaryContact, asPartner };
  }

  // Same reasoning as countActiveDeals above, for a Company rather than a
  // Contact -- used before letting remove() cascade-delete a Company, so an
  // active Deal never ends up silently pointing at a soft-deleted company.
  async countActiveDealsForCompany(companyId: string): Promise<{ asCompany: number; asPartner: number }> {
    const dealsRepo = this.dataSource.getRepository(Deal);
    const partnersRepo = this.dataSource.getRepository(DealPartnersMap);
    const [asCompany, asPartner] = await Promise.all([
      dealsRepo.count({ where: { companyId } }),
      partnersRepo.count({ where: { companyId } }),
    ]);
    return { asCompany, asPartner };
  }

  private async assertContactDeletable(contactId: string, label: string): Promise<void> {
    const { asContact, asPrimaryContact, asPartner } = await this.countActiveDeals(contactId);
    const parts: string[] = [];
    if (asContact > 0) parts.push(`${asContact} deal(s) as customer contact`);
    if (asPrimaryContact > 0) parts.push(`${asPrimaryContact} deal(s) as primary contact`);
    if (asPartner > 0) parts.push(`${asPartner} deal(s) as partner`);
    if (parts.length > 0) {
      this.logger.debug(`Blocked: contact ${contactId} still used by deals (${parts.join(", ")})`);
      throw new ConflictException(
        `Cannot delete ${label}: currently used by ${parts.join(", ")}. Update those deals first.`,
      );
    }
  }

  private async assertCompanyDeletable(companyId: string): Promise<void> {
    const { asCompany, asPartner } = await this.countActiveDealsForCompany(companyId);
    const parts: string[] = [];
    if (asCompany > 0) parts.push(`${asCompany} deal(s) as the company`);
    if (asPartner > 0) parts.push(`${asPartner} deal(s) as partner`);
    if (parts.length > 0) {
      this.logger.debug(`Blocked: company ${companyId} still used by deals (${parts.join(", ")})`);
      throw new ConflictException(
        `Cannot delete this company: currently used by ${parts.join(", ")}. Update those deals first.`,
      );
    }
  }

  async removeContactForCompany(
    relationshipTypeId: string,
    mapId: string,
    contactId: string,
    userId: string,
  ): Promise<void> {
    this.logger.debug(`removeContactForCompany called for contact ${contactId} under company party ${mapId} on relationship type ${relationshipTypeId} by ${userId}`);
    const party = await this.findOneOrFail(relationshipTypeId, mapId);
    if (!party.companyId) {
      this.logger.debug(`Blocked: party ${mapId} is not a company`);
      throw new BadRequestException("This relationship party is not a company");
    }
    const contact = await this.contactsRepo.findOneScoped({ where: { id: contactId, companyId: party.companyId } });
    if (!contact) {
      throw new NotFoundException("Contact not found for this company");
    }

    // A ConflictException here is an expected business-rule rejection, not a
    // system failure -- thrown before the try/catch below so it isn't logged
    // as an error, same as NotFoundException elsewhere.
    await this.assertContactDeletable(contactId, "this contact");

    try {
      await this.contactsRepo.softRemoveScoped(contact, userId);
      this.logger.debug(`removeContactForCompany succeeded for contact ${contactId}`);
      await this.auditLogService.record({
        entityType: "contact",
        entityId: contactId,
        action: "delete",
        actorId: userId,
        changes: { fullName: contact.fullName, companyId: party.companyId },
      });
    } catch (err) {
      this.logger.error(`removeContactForCompany failed for contact ${contactId}: ${(err as Error).message}`, (err as Error).stack);
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
    const { logo, ...companyDto } = dto;
    if (logo) {
      assertKeyBelongsToTenant(logo, LOGO_SEGMENT, this.tenantContext.getTenantSlug());
    }
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
    for (const key of Object.keys(companyDto)) {
      before[key] = companyAsRecord[key];
    }
    const oldLogoDoc = "logo" in dto
      ? await this.documentsService.findCurrentScoped(DocumentOwnerType.CompanyLogo, company.id)
      : null;

    try {
      Object.assign(company, companyDto, { updatedBy: userId });
      await this.companiesRepo.saveScoped(company);
      this.logger.debug(`updateCompany succeeded for company ${company.id}`);

      // Logo replace/clear -- hard-retires the old one (no history), per the
      // client's "pictures can just replace" call.
      if ("logo" in dto) {
        if (logo) {
          await this.documentsService.replaceSingle(DocumentOwnerType.CompanyLogo, company.id, logo, userId);
        } else {
          await this.documentsService.clearSingle(DocumentOwnerType.CompanyLogo, company.id);
        }
      }

      const changes: Record<string, { old: unknown; new: unknown }> = {};
      const companyAfterAsRecord = company as unknown as Record<string, unknown>;
      for (const key of Object.keys(companyDto)) {
        const newValue = companyAfterAsRecord[key];
        if (before[key] !== newValue) {
          changes[key] = { old: before[key], new: newValue };
        }
      }
      if ("logo" in dto && (oldLogoDoc?.s3Key ?? null) !== (logo ?? null)) {
        changes.logo = { old: oldLogoDoc?.s3Key ?? null, new: logo ?? null };
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

  // ── Cross-relationship-type tags (Relationships tab) ─────────────────
  // Everything below is scoped by the real Company/Contact id, not a
  // single-type mapId -- unlike every method above (which lives inside one
  // relationship type's own admin page), these back the "show all of one
  // party's tags across every type" Relationships tab on
  // CompanyFormDialog/ContactFormDialog.

  // relationshipType is loaded read-only for display (its resolved name) --
  // this list is never save()'d, so it stays clear of the TypeORM "never
  // save an entity loaded with relations" rule (see findAllForType above,
  // same reasoning). Returns BOTH active and inactive tags -- the caller
  // (RelationshipHubDiagram) renders the distinction with its own spoke
  // styling rather than the API hiding disabled tags entirely.
  async findTagsForCompany(companyId: string): Promise<RelationshipCompanyContactMap[]> {
    this.logger.debug(`findTagsForCompany called for company ${companyId}`);
    try {
      const company = await this.companiesRepo.findOneScoped({ where: { id: companyId } });
      if (!company) {
        this.logger.debug(`findTagsForCompany: company ${companyId} not found`);
        throw new NotFoundException("Company not found");
      }
      const tags = await this.partiesRepo.findScoped({
        where: { companyId },
        relations: ["relationshipType"],
        order: { createdAt: "ASC" },
      });
      this.logger.debug(`findTagsForCompany returning ${tags.length} tag(s) for company ${companyId} (active+inactive)`);
      return tags;
    } catch (err) {
      this.logger.error(`findTagsForCompany failed for company ${companyId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Same as findTagsForCompany, for a Contact. For a company-owned contact
  // this always returns an empty list -- company-owned contacts never get
  // their own tag row (see linkExistingContactToType's guard below), so
  // their tags live under the company instead. That's expected, not a bug.
  async findTagsForContact(contactId: string): Promise<RelationshipCompanyContactMap[]> {
    this.logger.debug(`findTagsForContact called for contact ${contactId}`);
    try {
      const contact = await this.contactsRepo.findOneScoped({ where: { id: contactId } });
      if (!contact) {
        this.logger.debug(`findTagsForContact: contact ${contactId} not found`);
        throw new NotFoundException("Contact not found");
      }
      const tags = await this.partiesRepo.findScoped({
        where: { contactId },
        relations: ["relationshipType"],
        order: { createdAt: "ASC" },
      });
      this.logger.debug(`findTagsForContact returning ${tags.length} tag(s) for contact ${contactId} (active+inactive)`);
      return tags;
    } catch (err) {
      this.logger.error(`findTagsForContact failed for contact ${contactId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Tags an *existing* Company into an additional Relationship Type, from
  // the Relationships tab -- distinct from addCompany above, which creates a
  // brand-new Company row from scratch. The pre-check below is a fast-path
  // UX nicety, not the real guard -- migration
  // 1784700000028-AddRelationshipCompanyContactMapUniqueIndexes adds a
  // partial unique index on (relationship_type_id, company_id), so two
  // concurrent requests racing past the pre-check both still land on the DB
  // constraint; the 23505 catch below turns that into the same clean 409
  // instead of a raw 500 (same precedent as
  // priority-task-shares.service.ts's add()). A disabled tag for the exact
  // same pair is reactivated via the existing setActive() rather than
  // creating a second row -- reusing that method also means the audit trail
  // for a reactivation stays entityType: "relationship_party" (its normal
  // audit shape), while a brand-new row below is logged separately as
  // entityType: "relationship_company_contact_map" (the insert's own audit
  // shape) -- deliberately different, not drift.
  async linkExistingCompanyToType(
    companyId: string,
    relationshipTypeId: string,
    userId: string,
  ): Promise<RelationshipCompanyContactMap> {
    this.logger.debug(`linkExistingCompanyToType called for company ${companyId} -> type ${relationshipTypeId} by ${userId}`);
    try {
      const relationshipType = await this.relationshipTypesService.findOneOrFail(relationshipTypeId);
      const company = await this.companiesRepo.findOneScoped({ where: { id: companyId } });
      if (!company) {
        this.logger.debug(`linkExistingCompanyToType: company ${companyId} not found`);
        throw new NotFoundException("Company not found");
      }

      const existing = await this.partiesRepo.findOneScoped({ where: { companyId, relationshipTypeId } });
      if (existing?.isActive) {
        this.logger.debug(`Blocked: company ${companyId} already actively tagged under type ${relationshipTypeId}`);
        throw new ConflictException("This company is already tagged under this relationship type");
      }

      if (existing) {
        this.logger.debug(`Reactivating disabled tag ${existing.id} for company ${companyId} -> type ${relationshipTypeId}`);
        const reactivated = await this.setActive(relationshipTypeId, existing.id, true, userId);
        // findOneOrFail (used inside setActive's own return) deliberately
        // doesn't load the relationshipType relation -- see its comment.
        // Attached here from the object already fetched above instead of a
        // second query.
        reactivated.relationshipType = relationshipType;
        return reactivated;
      }

      this.logger.debug(`No existing tag found, creating new tag for company ${companyId} -> type ${relationshipTypeId}`);
      const party = this.partiesRepo.createScoped({ relationshipTypeId, companyId, createdBy: userId });
      const saved = await this.partiesRepo.saveScoped(party);
      this.logger.debug(`linkExistingCompanyToType succeeded, new tag ${saved.id}`);

      await this.auditLogService.record({
        entityType: "relationship_company_contact_map",
        entityId: saved.id,
        action: "insert",
        actorId: userId,
        changes: { relationshipTypeId, companyId },
      });

      // Attaches the already-fetched relationshipType directly rather than
      // re-fetching via findOneOrFail (which deliberately doesn't load that
      // relation -- see its comment) -- avoids both an extra query and
      // widening the entity findOneOrFail returns.
      saved.relationshipType = relationshipType;
      return saved;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "23505") {
        this.logger.debug(`Concurrent duplicate tag for company ${companyId} -> type ${relationshipTypeId} -> 409`);
        throw new ConflictException("This company is already tagged under this relationship type");
      }
      if (code === "23503") {
        this.logger.debug(`Concurrent delete of company ${companyId} or type ${relationshipTypeId} -> 404`);
        throw new NotFoundException("Company or relationship type not found");
      }
      if (err instanceof ConflictException || err instanceof NotFoundException) {
        throw err;
      }
      this.logger.error(`linkExistingCompanyToType failed for company ${companyId} -> type ${relationshipTypeId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Same as linkExistingCompanyToType, for a standalone Contact. Guards
  // against tagging a company-owned contact independently -- those
  // deliberately have no relationship_company_contact_map row of their own
  // (see addCompany/addContact above, the 2026-07-22 double-counting fix);
  // allowing one here would reopen that exact bug. The frontend already
  // hides this action for a company-owned contact, but the guard lives here
  // too since the frontend isn't the source of truth for this rule.
  async linkExistingContactToType(
    contactId: string,
    relationshipTypeId: string,
    userId: string,
  ): Promise<RelationshipCompanyContactMap> {
    this.logger.debug(`linkExistingContactToType called for contact ${contactId} -> type ${relationshipTypeId} by ${userId}`);
    try {
      const relationshipType = await this.relationshipTypesService.findOneOrFail(relationshipTypeId);
      const contact = await this.contactsRepo.findOneScoped({ where: { id: contactId } });
      if (!contact) {
        this.logger.debug(`linkExistingContactToType: contact ${contactId} not found`);
        throw new NotFoundException("Contact not found");
      }
      if (contact.companyId) {
        this.logger.debug(`Blocked: contact ${contactId} belongs to company ${contact.companyId}, cannot tag independently`);
        throw new BadRequestException("This contact belongs to a company -- tag the company instead of the contact directly");
      }

      const existing = await this.partiesRepo.findOneScoped({ where: { contactId, relationshipTypeId } });
      if (existing?.isActive) {
        this.logger.debug(`Blocked: contact ${contactId} already actively tagged under type ${relationshipTypeId}`);
        throw new ConflictException("This contact is already tagged under this relationship type");
      }

      if (existing) {
        this.logger.debug(`Reactivating disabled tag ${existing.id} for contact ${contactId} -> type ${relationshipTypeId}`);
        const reactivated = await this.setActive(relationshipTypeId, existing.id, true, userId);
        reactivated.relationshipType = relationshipType;
        return reactivated;
      }

      this.logger.debug(`No existing tag found, creating new tag for contact ${contactId} -> type ${relationshipTypeId}`);
      const party = this.partiesRepo.createScoped({ relationshipTypeId, contactId, createdBy: userId });
      const saved = await this.partiesRepo.saveScoped(party);
      this.logger.debug(`linkExistingContactToType succeeded, new tag ${saved.id}`);

      await this.auditLogService.record({
        entityType: "relationship_company_contact_map",
        entityId: saved.id,
        action: "insert",
        actorId: userId,
        changes: { relationshipTypeId, contactId },
      });

      saved.relationshipType = relationshipType;
      return saved;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "23505") {
        this.logger.debug(`Concurrent duplicate tag for contact ${contactId} -> type ${relationshipTypeId} -> 409`);
        throw new ConflictException("This contact is already tagged under this relationship type");
      }
      if (code === "23503") {
        this.logger.debug(`Concurrent delete of contact ${contactId} or type ${relationshipTypeId} -> 404`);
        throw new NotFoundException("Contact or relationship type not found");
      }
      if (err instanceof ConflictException || err instanceof NotFoundException || err instanceof BadRequestException) {
        throw err;
      }
      this.logger.error(`linkExistingContactToType failed for contact ${contactId} -> type ${relationshipTypeId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Previously this only soft-deleted the relationship_company_contact_map
  // row itself, leaving the Company/Contact it tagged fully active --
  // still returned by every picker, still visible under any other
  // relationship type it was also tagged to, effectively undeletable by a
  // normal user from then on. Now cascades all the way to the real entity,
  // per CLAUDE.md's "cascade must reach the real leaf entity" rule.
  async remove(relationshipTypeId: string, mapId: string, userId: string): Promise<void> {
    this.logger.debug(`remove called for party ${mapId} on relationship type ${relationshipTypeId} by ${userId}`);
    const party = await this.findOneOrFail(relationshipTypeId, mapId);
    const companyName = party.company?.name ?? null;
    const contactName = party.contact?.fullName ?? null;

    // A ConflictException here is an expected business-rule rejection, not a
    // system failure -- checked before the try/catch below so it isn't
    // logged as an error, same as NotFoundException elsewhere.
    let ownedContacts: Contact[] = [];
    if (party.companyId) {
      await this.assertCompanyDeletable(party.companyId);
      ownedContacts = await this.contactsRepo.findScoped({ where: { companyId: party.companyId } });
      for (const contact of ownedContacts) {
        await this.assertContactDeletable(contact.id, `its contact "${contact.fullName}"`);
      }
    } else if (party.contactId) {
      await this.assertContactDeletable(party.contactId, "this contact");
    }

    try {
      const tenantId = this.tenantContext.getTenantId();
      // Bare re-fetch for the mutation target -- `party` above was loaded
      // with relations (company, company.territoryOwner, contact) for
      // display, and CLAUDE.md's TypeORM rule says never save()/softRemove()
      // an entity that was loaded with relations.
      const bareParty = await this.partiesRepo.findOneScoped({ where: { id: mapId } });
      if (!bareParty) {
        throw new NotFoundException("Relationship party not found");
      }

      await this.dataSource.transaction(async (manager) => {
        const partyRepo = manager.getRepository(RelationshipCompanyContactMap);
        const companyRepo = manager.getRepository(Company);
        const contactRepo = manager.getRepository(Contact);

        await partyRepo.softRemove(bareParty);
        await partyRepo.update(bareParty.id, { deletedBy: userId });

        if (party.companyId) {
          const bareCompany = await companyRepo.findOne({ where: { id: party.companyId, tenantId } });
          if (bareCompany) {
            await companyRepo.softRemove(bareCompany);
            await companyRepo.update(bareCompany.id, { deletedBy: userId });
          }
          if (ownedContacts.length > 0) {
            await contactRepo.softRemove(ownedContacts);
            await contactRepo.update(ownedContacts.map((c) => c.id), { deletedBy: userId });
          }
        } else if (party.contactId) {
          const bareContact = await contactRepo.findOne({ where: { id: party.contactId, tenantId } });
          if (bareContact) {
            await contactRepo.softRemove(bareContact);
            await contactRepo.update(bareContact.id, { deletedBy: userId });
          }
        }
      });
      this.logger.debug(`remove succeeded for party ${mapId}`);

      await this.auditLogService.record({
        entityType: "relationship_party",
        entityId: mapId,
        action: "delete",
        actorId: userId,
        changes: { relationshipTypeId, companyId: party.companyId ?? null, contactId: party.contactId ?? null },
      });
      if (party.companyId) {
        await this.auditLogService.record({
          entityType: "company",
          entityId: party.companyId,
          action: "delete",
          actorId: userId,
          changes: { name: companyName, cascadedContactCount: ownedContacts.length },
        });
        for (const contact of ownedContacts) {
          await this.auditLogService.record({
            entityType: "contact",
            entityId: contact.id,
            action: "delete",
            actorId: userId,
            changes: { fullName: contact.fullName, companyId: party.companyId, cascadeReason: "company deleted" },
          });
        }
      } else if (party.contactId) {
        await this.auditLogService.record({
          entityType: "contact",
          entityId: party.contactId,
          action: "delete",
          actorId: userId,
          changes: { fullName: contactName },
        });
      }
    } catch (err) {
      this.logger.error(`remove failed for party ${mapId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
