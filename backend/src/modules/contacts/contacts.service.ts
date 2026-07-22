import { Injectable, Logger } from "@nestjs/common";
import { Contact } from "./entities/contact.entity";
import { ContactsRepository } from "./contacts.repository";

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(private readonly contactsRepo: ContactsRepository) {}

  async findPicker(companyId?: string): Promise<Contact[]> {
    this.logger.debug(`findPicker called (companyId=${companyId ?? "none"})`);
    try {
      const qb = this.contactsRepo
        .queryBuilderScoped("contact")
        .orderBy("contact.fullName", "ASC")
        .take(50);

      if (companyId) {
        this.logger.debug(`Filtering to contacts of company ${companyId}`);
        qb.andWhere("contact.company_id = :companyId", { companyId });
      } else {
        this.logger.debug("No companyId filter provided, returning unfiltered top 50");
      }

      const results = await qb.getMany();
      this.logger.debug(`findPicker returning ${results.length} row(s)`);
      return results;
    } catch (err) {
      this.logger.error(`findPicker failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
