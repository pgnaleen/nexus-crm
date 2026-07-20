import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DealContactsMap } from "./entities/deal-contacts-map.entity";
import { DealsService } from "./deals.service";

@Injectable()
export class DealContactsService {
  constructor(
    @InjectRepository(DealContactsMap) private readonly repo: Repository<DealContactsMap>,
    private readonly dealsService: DealsService,
  ) {}

  async findAll(dealId: string): Promise<DealContactsMap[]> {
    await this.dealsService.findOneOrFail(dealId);
    return this.repo.find({ where: { dealId }, relations: ["contact"] });
  }

  async add(dealId: string, contactId: string, userId: string): Promise<DealContactsMap> {
    await this.dealsService.findOneOrFail(dealId);

    const existing = await this.repo.findOne({ where: { dealId, contactId } });
    if (existing) {
      throw new ConflictException("Contact is already linked to this deal");
    }

    const map = this.repo.create({ dealId, contactId, createdById: userId });
    await this.repo.save(map);

    const withContact = await this.repo.findOne({ where: { dealId, contactId }, relations: ["contact"] });
    if (!withContact) {
      throw new NotFoundException("Deal contact link not found after creation");
    }
    return withContact;
  }

  async remove(dealId: string, contactId: string): Promise<void> {
    await this.dealsService.findOneOrFail(dealId);
    const map = await this.repo.findOne({ where: { dealId, contactId } });
    if (!map) {
      throw new NotFoundException("Deal contact link not found");
    }
    await this.repo.remove(map);
  }
}
