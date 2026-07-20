import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDealPartnersMap1784600000000 implements MigrationInterface {
    name = 'CreateDealPartnersMap1784600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // A deal's customer can now be a bare contact with no company of its
        // own (companyId was previously required), matching the "Other Party"
        // picker's existing company-or-contact UX. The CHECK keeps every deal
        // pointed at *some* customer.
        await queryRunner.query(`ALTER TABLE "deals" ALTER COLUMN "company_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "deals" ADD CONSTRAINT "CHK_deals_customer_company_or_contact" CHECK (("company_id" IS NOT NULL) OR ("contact_id" IS NOT NULL))`);

        // deal_contacts_map ("Linked Contacts") is generalized into
        // deal_partners_map: a partner is now a company OR a contact, and a
        // deal can have several. Composite PK (deal_id, contact_id) can't
        // hold a nullable contact_id, so it's replaced with a surrogate id --
        // same repair sequence already used for relationship_company_contact_map.
        await queryRunner.query(`ALTER TABLE "deal_contacts_map" RENAME TO "deal_partners_map"`);
        await queryRunner.query(`ALTER TABLE "deal_partners_map" ADD "id" uuid NOT NULL DEFAULT uuid_generate_v4()`);
        await queryRunner.query(`ALTER TABLE "deal_partners_map" DROP CONSTRAINT "PK_5c8891e89e5f874f354dffc5834"`);
        await queryRunner.query(`ALTER TABLE "deal_partners_map" ADD CONSTRAINT "PK_deal_partners_map_id" PRIMARY KEY ("id")`);
        await queryRunner.query(`ALTER TABLE "deal_partners_map" ALTER COLUMN "contact_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "deal_partners_map" ADD "company_id" uuid`);
        await queryRunner.query(`ALTER TABLE "deal_partners_map" ADD CONSTRAINT "FK_deal_partners_map_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deal_partners_map" ADD CONSTRAINT "CHK_deal_partners_map_company_or_contact" CHECK (("company_id" IS NOT NULL AND "contact_id" IS NULL) OR ("company_id" IS NULL AND "contact_id" IS NOT NULL))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_deal_partners_map_deal_company" ON "deal_partners_map" ("deal_id", "company_id") WHERE "company_id" IS NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_deal_partners_map_deal_contact" ON "deal_partners_map" ("deal_id", "contact_id") WHERE "contact_id" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "UQ_deal_partners_map_deal_contact"`);
        await queryRunner.query(`DROP INDEX "UQ_deal_partners_map_deal_company"`);
        await queryRunner.query(`ALTER TABLE "deal_partners_map" DROP CONSTRAINT "CHK_deal_partners_map_company_or_contact"`);
        await queryRunner.query(`ALTER TABLE "deal_partners_map" DROP CONSTRAINT "FK_deal_partners_map_company"`);
        await queryRunner.query(`ALTER TABLE "deal_partners_map" DROP COLUMN "company_id"`);
        await queryRunner.query(`ALTER TABLE "deal_partners_map" ALTER COLUMN "contact_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "deal_partners_map" DROP CONSTRAINT "PK_deal_partners_map_id"`);
        await queryRunner.query(`ALTER TABLE "deal_partners_map" ADD CONSTRAINT "PK_5c8891e89e5f874f354dffc5834" PRIMARY KEY ("deal_id", "contact_id")`);
        await queryRunner.query(`ALTER TABLE "deal_partners_map" DROP COLUMN "id"`);
        await queryRunner.query(`ALTER TABLE "deal_partners_map" RENAME TO "deal_contacts_map"`);

        await queryRunner.query(`ALTER TABLE "deals" DROP CONSTRAINT "CHK_deals_customer_company_or_contact"`);
        await queryRunner.query(`ALTER TABLE "deals" ALTER COLUMN "company_id" SET NOT NULL`);
    }

}
