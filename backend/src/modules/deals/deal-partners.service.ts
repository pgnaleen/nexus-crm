import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CompaniesRepository } from "../companies/companies.repository";
import { ContactsRepository } from "../contacts/contacts.repository";
import { DealPartnersMap } from "./entities/deal-partners-map.entity";
import { DealsService } from "./deals.service";

@Injectable()
export class DealPartnersService {
  constructor(
    @InjectRepository(DealPartnersMap) private readonly repo: Repository<DealPartnersMap>,
    private readonly dealsService: DealsService,
    private readonly companiesRepo: CompaniesRepository,
    private readonly contactsRepo: ContactsRepository,
  ) {}

  async findAll(dealId: string): Promise<DealPartnersMap[]> {
    await this.dealsService.findOneOrFail(dealId);
    return this.repo.find({ where: { dealId }, relations: ["company", "contact"] });
  }

  async addCompany(dealId: string, companyId: string, userId: string): Promise<DealPartnersMap> {
    await this.dealsService.findOneOrFail(dealId);

    // Tenant-scoped lookup -- without this, a caller could link another
    // tenant's company by guessing/knowing its uuid, and findAll() would
    // then leak that company's name back in the API response.
    const company = await this.companiesRepo.findOneScoped({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException("Company not found");
    }

    const existing = await this.repo.findOne({ where: { dealId, companyId } });
    if (existing) {
      throw new ConflictException("Company is already linked to this deal as a partner");
    }

    const map = this.repo.create({ dealId, companyId, createdById: userId });
    const saved = await this.repo.save(map);
    return this.findOneWithRelationsOrFail(dealId, saved.id);
  }

  async addContact(dealId: string, contactId: string, userId: string): Promise<DealPartnersMap> {
    await this.dealsService.findOneOrFail(dealId);

    const contact = await this.contactsRepo.findOneScoped({ where: { id: contactId } });
    if (!contact) {
      throw new NotFoundException("Contact not found");
    }

    const existing = await this.repo.findOne({ where: { dealId, contactId } });
    if (existing) {
      throw new ConflictException("Contact is already linked to this deal as a partner");
    }

    const map = this.repo.create({ dealId, contactId, createdById: userId });
    const saved = await this.repo.save(map);
    return this.findOneWithRelationsOrFail(dealId, saved.id);
  }

  async remove(dealId: string, partnerId: string): Promise<void> {
    await this.dealsService.findOneOrFail(dealId);
    const map = await this.repo.findOne({ where: { id: partnerId, dealId } });
    if (!map) {
      throw new NotFoundException("Deal partner link not found");
    }
    await this.repo.remove(map);
  }

  private async findOneWithRelationsOrFail(dealId: string, id: string): Promise<DealPartnersMap> {
    const map = await this.repo.findOne({ where: { id, dealId }, relations: ["company", "contact"] });
    if (!map) {
      throw new NotFoundException("Deal partner link not found after creation");
    }
    return map;
  }
}
