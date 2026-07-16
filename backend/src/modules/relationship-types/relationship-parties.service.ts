import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CompaniesRepository } from "../companies/companies.repository";
import { ContactsRepository } from "../contacts/contacts.repository";
import { CreateRelationshipPartyCompanyDto } from "./dto/create-relationship-party-company.dto";
import { CreateRelationshipPartyContactDto } from "./dto/create-relationship-party-contact.dto";
import { UpdateRelationshipPartyCompanyDto } from "./dto/update-relationship-party-company.dto";
import { UpdateRelationshipPartyContactDto } from "./dto/update-relationship-party-contact.dto";
import { RelationshipCompanyContactMap } from "./entities/relationship-company-contact-map.entity";
import { RelationshipPartiesRepository } from "./relationship-parties.repository";
import { RelationshipTypesService } from "./relationship-types.service";

@Injectable()
export class RelationshipPartiesService {
  constructor(
    private readonly partiesRepo: RelationshipPartiesRepository,
    private readonly companiesRepo: CompaniesRepository,
    private readonly contactsRepo: ContactsRepository,
    private readonly relationshipTypesService: RelationshipTypesService,
  ) {}

  async findAllForType(relationshipTypeId: string): Promise<RelationshipCompanyContactMap[]> {
    await this.relationshipTypesService.findOneOrFail(relationshipTypeId);
    return this.partiesRepo.findScoped({
      where: { relationshipTypeId },
      relations: ["company", "contact"],
      order: { createdAt: "DESC" },
    });
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
    await this.relationshipTypesService.findOneOrFail(relationshipTypeId);
    const company = this.companiesRepo.createScoped({ ...dto, createdBy: userId });
    const savedCompany = await this.companiesRepo.saveScoped(company);

    const party = this.partiesRepo.createScoped({
      relationshipTypeId,
      companyId: savedCompany.id,
      createdBy: userId,
    });
    const savedParty = await this.partiesRepo.saveScoped(party);
    return this.findOneOrFail(relationshipTypeId, savedParty.id);
  }

  async addContact(
    relationshipTypeId: string,
    dto: CreateRelationshipPartyContactDto,
    userId: string,
  ): Promise<RelationshipCompanyContactMap> {
    await this.relationshipTypesService.findOneOrFail(relationshipTypeId);
    const contact = this.contactsRepo.createScoped({ ...dto, createdBy: userId });
    const savedContact = await this.contactsRepo.saveScoped(contact);

    const party = this.partiesRepo.createScoped({
      relationshipTypeId,
      contactId: savedContact.id,
      createdBy: userId,
    });
    const savedParty = await this.partiesRepo.saveScoped(party);
    return this.findOneOrFail(relationshipTypeId, savedParty.id);
  }

  async updateCompany(
    relationshipTypeId: string,
    mapId: string,
    dto: UpdateRelationshipPartyCompanyDto,
    userId: string,
  ): Promise<RelationshipCompanyContactMap> {
    const party = await this.findOneOrFail(relationshipTypeId, mapId);
    if (!party.companyId) {
      throw new BadRequestException("This relationship party is not a company");
    }
    const company = await this.companiesRepo.findOneScoped({ where: { id: party.companyId } });
    if (!company) {
      throw new NotFoundException("Company not found");
    }
    Object.assign(company, dto, { updatedBy: userId });
    await this.companiesRepo.saveScoped(company);
    // Re-fetch rather than trust the in-memory object -- Object.assign copies
    // omitted dto fields as explicit `undefined`, which would misreport
    // untouched columns as missing in the API response.
    return this.findOneOrFail(relationshipTypeId, mapId);
  }

  async updateContact(
    relationshipTypeId: string,
    mapId: string,
    dto: UpdateRelationshipPartyContactDto,
    userId: string,
  ): Promise<RelationshipCompanyContactMap> {
    const party = await this.findOneOrFail(relationshipTypeId, mapId);
    if (!party.contactId) {
      throw new BadRequestException("This relationship party is not a person");
    }
    const contact = await this.contactsRepo.findOneScoped({ where: { id: party.contactId } });
    if (!contact) {
      throw new NotFoundException("Contact not found");
    }
    Object.assign(contact, dto, { updatedBy: userId });
    await this.contactsRepo.saveScoped(contact);
    return this.findOneOrFail(relationshipTypeId, mapId);
  }

  async setActive(
    relationshipTypeId: string,
    mapId: string,
    isActive: boolean,
    userId: string,
  ): Promise<RelationshipCompanyContactMap> {
    const party = await this.findOneOrFail(relationshipTypeId, mapId);
    party.isActive = isActive;
    party.updatedBy = userId;
    await this.partiesRepo.saveScoped(party);
    return this.findOneOrFail(relationshipTypeId, mapId);
  }

  async remove(relationshipTypeId: string, mapId: string): Promise<void> {
    const party = await this.findOneOrFail(relationshipTypeId, mapId);
    await this.partiesRepo.softRemoveScoped(party);
  }
}
