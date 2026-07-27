import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseTenantRepository, TenantContextService } from "../../core/tenant";
import { Contact } from "./entities/contact.entity";

@Injectable()
export class ContactsRepository extends BaseTenantRepository<Contact> {
  constructor(
    @InjectRepository(Contact) repo: Repository<Contact>,
    tenantContext: TenantContextService,
  ) {
    super(repo, tenantContext);
  }

  async softRemoveScoped(contact: Contact, actorId?: string): Promise<void> {
    if (contact.tenantId !== this.tenantContext.getTenantId()) {
      throw new ForbiddenException("Entity does not belong to the current tenant");
    }
    await this.repo.softRemove(contact);
    await this.repo.update(contact.id, { deletedBy: actorId });
  }
}
