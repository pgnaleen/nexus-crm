import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLogService } from "../../core/audit-log/audit-log.service";
import { TenantContextService } from "../../core/tenant";
import { CompaniesRepository } from "../companies/companies.repository";
import { ContactsRepository } from "../contacts/contacts.repository";
import { DealPartnersMap } from "./entities/deal-partners-map.entity";
import { DealsService } from "./deals.service";

const AUDIT_ENTITY_TYPE = "deal_partner";

@Injectable()
export class DealPartnersService {
  private readonly logger = new Logger(DealPartnersService.name);

  constructor(
    @InjectRepository(DealPartnersMap) private readonly repo: Repository<DealPartnersMap>,
    private readonly dealsService: DealsService,
    private readonly companiesRepo: CompaniesRepository,
    private readonly contactsRepo: ContactsRepository,
    private readonly auditLogService: AuditLogService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(dealId: string): Promise<DealPartnersMap[]> {
    this.logger.debug(`findAll called for deal ${dealId}`);
    await this.dealsService.findOneOrFail(dealId);
    const maps = await this.repo.find({ where: { dealId }, relations: ["company", "contact"] });
    this.logger.debug(`findAll returning ${maps.length} partner(s) for deal ${dealId}`);
    return maps;
  }

  // Id-only, every link in the tenant -- powers the Funnel board's Partner
  // filter. DealPartnersMap has no tenant_id column of its own (it's a bare
  // join table), so tenant scoping happens via an inner join to deal, same
  // as the cascade-delete lookup in deals.service.ts.
  async findAllLinksForTenant(): Promise<DealPartnersMap[]> {
    this.logger.debug("findAllLinksForTenant called");
    try {
      const tenantId = this.tenantContext.getTenantId();
      const links = await this.repo
        .createQueryBuilder("map")
        .innerJoin("map.deal", "deal")
        .where("deal.tenant_id = :tenantId", { tenantId })
        .andWhere("deal.deleted_at IS NULL")
        .getMany();
      this.logger.debug(`findAllLinksForTenant returning ${links.length} link(s)`);
      return links;
    } catch (err) {
      this.logger.error(`findAllLinksForTenant failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async addCompany(dealId: string, companyId: string, userId: string): Promise<DealPartnersMap> {
    this.logger.debug(`addCompany called for deal ${dealId} by ${userId} (companyId=${companyId})`);
    await this.dealsService.findOneOrFail(dealId);

    // Tenant-scoped lookup -- without this, a caller could link another
    // tenant's company by guessing/knowing its uuid, and findAll() would
    // then leak that company's name back in the API response.
    const company = await this.companiesRepo.findOneScoped({ where: { id: companyId } });
    if (!company) {
      this.logger.debug(`Blocked: company ${companyId} not found for this tenant`);
      throw new NotFoundException("Company not found");
    }

    const existing = await this.repo.findOne({ where: { dealId, companyId } });
    if (existing) {
      this.logger.debug(`Blocked: company ${companyId} is already linked to deal ${dealId}`);
      throw new ConflictException("Company is already linked to this deal as a partner");
    }

    try {
      const map = this.repo.create({ dealId, companyId, createdById: userId });
      const saved = await this.repo.save(map);
      this.logger.debug(`addCompany succeeded, partner link ${saved.id}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: saved.id,
        action: "insert",
        actorId: userId,
        changes: { dealId, companyId, companyName: company.name },
      });
      return this.findOneWithRelationsOrFail(dealId, saved.id);
    } catch (err) {
      this.logger.error(`addCompany failed for deal ${dealId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async addContact(dealId: string, contactId: string, userId: string): Promise<DealPartnersMap> {
    this.logger.debug(`addContact called for deal ${dealId} by ${userId} (contactId=${contactId})`);
    await this.dealsService.findOneOrFail(dealId);

    const contact = await this.contactsRepo.findOneScoped({ where: { id: contactId } });
    if (!contact) {
      this.logger.debug(`Blocked: contact ${contactId} not found for this tenant`);
      throw new NotFoundException("Contact not found");
    }

    const existing = await this.repo.findOne({ where: { dealId, contactId } });
    if (existing) {
      this.logger.debug(`Blocked: contact ${contactId} is already linked to deal ${dealId}`);
      throw new ConflictException("Contact is already linked to this deal as a partner");
    }

    try {
      const map = this.repo.create({ dealId, contactId, createdById: userId });
      const saved = await this.repo.save(map);
      this.logger.debug(`addContact succeeded, partner link ${saved.id}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: saved.id,
        action: "insert",
        actorId: userId,
        changes: { dealId, contactId, contactName: contact.fullName },
      });
      return this.findOneWithRelationsOrFail(dealId, saved.id);
    } catch (err) {
      this.logger.error(`addContact failed for deal ${dealId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  async remove(dealId: string, partnerId: string, userId: string): Promise<void> {
    this.logger.debug(`remove called for partner link ${partnerId} on deal ${dealId} by ${userId}`);
    await this.dealsService.findOneOrFail(dealId);
    const map = await this.repo.findOne({ where: { id: partnerId, dealId } });
    if (!map) {
      this.logger.debug(`Blocked: partner link ${partnerId} not found on deal ${dealId}`);
      throw new NotFoundException("Deal partner link not found");
    }
    try {
      await this.repo.remove(map);
      this.logger.debug(`remove succeeded for partner link ${partnerId}`);
      await this.auditLogService.record({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: partnerId,
        action: "delete",
        actorId: userId,
        changes: { dealId, companyId: map.companyId ?? null, contactId: map.contactId ?? null },
      });
    } catch (err) {
      this.logger.error(`remove failed for partner link ${partnerId}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  private async findOneWithRelationsOrFail(dealId: string, id: string): Promise<DealPartnersMap> {
    const map = await this.repo.findOne({ where: { id, dealId }, relations: ["company", "contact"] });
    if (!map) {
      throw new NotFoundException("Deal partner link not found after creation");
    }
    return map;
  }
}
