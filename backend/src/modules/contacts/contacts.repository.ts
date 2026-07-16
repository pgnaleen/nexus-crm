import { Injectable } from "@nestjs/common";
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
}
