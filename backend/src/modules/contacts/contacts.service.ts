import { Injectable, Logger } from "@nestjs/common";
import { Contact } from "./entities/contact.entity";
import { ContactsRepository } from "./contacts.repository";

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(private readonly contactsRepo: ContactsRepository) {}

  // Used by the Deal Customer/Partner pickers. Matches ONLY contacts directly
  // tagged with their own map row for this type -- deliberately does NOT
  // inherit the tag from a company-owned contact's parent company (2026-07-23:
  // reverted the earlier inherit-from-company behavior per product decision --
  // when a company is tagged, only the company itself shows in this picker;
  // its contacts stay selectable via the separate "Primary Contact" field
  // once that company is picked, so nothing is lost, but a company-owned
  // contact no longer also appears as its own duplicate-looking entry here).
  async findPickerForRelationshipType(relationshipTypeId: string): Promise<Contact[]> {
    this.logger.debug(`findPickerForRelationshipType called (relationshipTypeId=${relationshipTypeId})`);
    try {
      const results = await this.contactsRepo
        .queryBuilderScoped("contact")
        .andWhere(
          `contact.id IN (
             SELECT contact_id FROM relationship_company_contact_map
             WHERE relationship_type_id = :relationshipTypeId AND contact_id IS NOT NULL AND deleted_at IS NULL
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
