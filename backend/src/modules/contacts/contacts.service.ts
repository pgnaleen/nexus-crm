import { Injectable, Logger } from "@nestjs/common";
import { Contact } from "./entities/contact.entity";
import { ContactsRepository } from "./contacts.repository";

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(private readonly contactsRepo: ContactsRepository) {}

  // Used by the Deal Customer/Partner pickers. Matches contacts EITHER
  // directly tagged with their own map row OR owned by a company that has a
  // map row for this type -- company-owned contacts deliberately don't get
  // their own map row (the 2026-07-22 double-counting fix), so without this
  // OR they'd vanish from the filtered list entirely instead of correctly
  // inheriting their parent company's tag.
  async findPickerForRelationshipType(relationshipTypeId: string): Promise<Contact[]> {
    this.logger.debug(`findPickerForRelationshipType called (relationshipTypeId=${relationshipTypeId})`);
    try {
      const results = await this.contactsRepo
        .queryBuilderScoped("contact")
        .andWhere(
          `contact.id IN (
             SELECT contact_id FROM relationship_company_contact_map
             WHERE relationship_type_id = :relationshipTypeId AND contact_id IS NOT NULL AND deleted_at IS NULL
           )
           OR contact.company_id IN (
             SELECT company_id FROM relationship_company_contact_map
             WHERE relationship_type_id = :relationshipTypeId AND company_id IS NOT NULL AND deleted_at IS NULL
           )`,
          { relationshipTypeId },
        )
        .orderBy("contact.fullName", "ASC")
        .getMany();
      this.logger.debug(`findPickerForRelationshipType returning ${results.length} row(s)`);
      return results;
    } catch (err) {
      this.logger.error(`findPickerForRelationshipType failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

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
