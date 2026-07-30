import { MigrationInterface, QueryRunner } from "typeorm";

// A deal's customer (companyId/contactId) becomes fully optional -- a deal
// can be created with neither set and one added later. Drops the CHECK that
// previously required at least one of the two to be present.
export class DropDealsCustomerRequiredCheck1784700000026 implements MigrationInterface {
  name = "DropDealsCustomerRequiredCheck1784700000026";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deals" DROP CONSTRAINT "CHK_deals_customer_company_or_contact"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "deals" ADD CONSTRAINT "CHK_deals_customer_company_or_contact"
      CHECK (("company_id" IS NOT NULL) OR ("contact_id" IS NOT NULL))
    `);
  }
}
