import { Injectable } from "@nestjs/common";
import { Contact } from "./entities/contact.entity";
import { ContactsRepository } from "./contacts.repository";

@Injectable()
export class ContactsService {
  constructor(private readonly contactsRepo: ContactsRepository) {}

  async findPicker(companyId?: string): Promise<Contact[]> {
    const qb = this.contactsRepo
      .queryBuilderScoped("contact")
      .orderBy("contact.fullName", "ASC")
      .take(50);

    if (companyId) {
      qb.andWhere("contact.company_id = :companyId", { companyId });
    }

    return qb.getMany();
  }
}
