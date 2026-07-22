import { MigrationInterface, QueryRunner } from "typeorm";

// Part of the "Add Deal" backend build-out: removes Deal columns confirmed
// unused anywhere in the client-approved frontend (description,
// referredByCompanyId/referredByEmployeeId, probability, priority,
// currency), adds columns for fields the Add Deal dialog already collects
// but has nowhere to persist (Deal Country, Customer Pain Point, Product,
// Services, Internal/External Costs, Competitors, Pre-Sales Person, PMO),
// and creates deal_notes for the comment-thread tab. See the approved plan
// for the full rationale -- every removed column was confirmed to have zero
// references anywhere in frontend/src and zero seed data before this
// migration was written.
export class AlterDealsAddNewFieldsAndDealNotes1784700000003 implements MigrationInterface {
  name = "AlterDealsAddNewFieldsAndDealNotes1784700000003";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop unused columns (+ their FKs/enum type first)
    await queryRunner.query(`ALTER TABLE "deals" DROP CONSTRAINT "FK_6a802a4a903c31825dc788cf39c"`);
    await queryRunner.query(`ALTER TABLE "deals" DROP CONSTRAINT "FK_d95c87314737b19864bb126940b"`);
    await queryRunner.query(`ALTER TABLE "deals" DROP COLUMN "description"`);
    await queryRunner.query(`ALTER TABLE "deals" DROP COLUMN "referred_by_company_id"`);
    await queryRunner.query(`ALTER TABLE "deals" DROP COLUMN "referred_by_employee_id"`);
    await queryRunner.query(`ALTER TABLE "deals" DROP COLUMN "currency"`);
    await queryRunner.query(`ALTER TABLE "deals" DROP COLUMN "probability"`);
    await queryRunner.query(`ALTER TABLE "deals" DROP COLUMN "priority"`);
    await queryRunner.query(`DROP TYPE "deals_priority_enum"`);

    // Add new columns
    await queryRunner.query(`ALTER TABLE "deals" ADD "deal_country" character varying`);
    await queryRunner.query(`ALTER TABLE "deals" ADD "customer_pain_point" text`);
    await queryRunner.query(`ALTER TABLE "deals" ADD "product" character varying`);
    await queryRunner.query(`ALTER TABLE "deals" ADD "services" character varying`);
    await queryRunner.query(`ALTER TABLE "deals" ADD "internal_costs" numeric(14,2)`);
    await queryRunner.query(`ALTER TABLE "deals" ADD "external_costs" numeric(14,2)`);
    await queryRunner.query(`ALTER TABLE "deals" ADD "competitors" jsonb`);
    await queryRunner.query(`ALTER TABLE "deals" ADD "pre_sales_person_id" uuid`);
    await queryRunner.query(`ALTER TABLE "deals" ADD "pmo_id" uuid`);
    await queryRunner.query(`
      ALTER TABLE "deals" ADD CONSTRAINT "FK_deals_pre_sales_person"
      FOREIGN KEY ("pre_sales_person_id") REFERENCES "employees"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "deals" ADD CONSTRAINT "FK_deals_pmo"
      FOREIGN KEY ("pmo_id") REFERENCES "employees"("id") ON DELETE SET NULL
    `);

    // New deal_notes table -- mirrors deal_documents' exact shape (no
    // tenant_id of its own; tenant scoping is proxied via the parent Deal).
    await queryRunner.query(`
      CREATE TABLE "deal_notes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "deleted_at" TIMESTAMP,
        "deleted_by" uuid,
        "deal_id" uuid NOT NULL,
        "text" text NOT NULL,
        CONSTRAINT "PK_deal_notes_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "deal_notes" ADD CONSTRAINT "FK_deal_notes_deal"
      FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "deal_notes" ADD CONSTRAINT "FK_deal_notes_created_by"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "deal_notes" ADD CONSTRAINT "FK_deal_notes_updated_by"
      FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "deal_notes" ADD CONSTRAINT "FK_deal_notes_deleted_by"
      FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "deal_notes"`);

    await queryRunner.query(`ALTER TABLE "deals" DROP CONSTRAINT "FK_deals_pmo"`);
    await queryRunner.query(`ALTER TABLE "deals" DROP CONSTRAINT "FK_deals_pre_sales_person"`);
    await queryRunner.query(`ALTER TABLE "deals" DROP COLUMN "pmo_id"`);
    await queryRunner.query(`ALTER TABLE "deals" DROP COLUMN "pre_sales_person_id"`);
    await queryRunner.query(`ALTER TABLE "deals" DROP COLUMN "competitors"`);
    await queryRunner.query(`ALTER TABLE "deals" DROP COLUMN "external_costs"`);
    await queryRunner.query(`ALTER TABLE "deals" DROP COLUMN "internal_costs"`);
    await queryRunner.query(`ALTER TABLE "deals" DROP COLUMN "services"`);
    await queryRunner.query(`ALTER TABLE "deals" DROP COLUMN "product"`);
    await queryRunner.query(`ALTER TABLE "deals" DROP COLUMN "customer_pain_point"`);
    await queryRunner.query(`ALTER TABLE "deals" DROP COLUMN "deal_country"`);

    await queryRunner.query(`CREATE TYPE "deals_priority_enum" AS ENUM ('low', 'medium', 'high', 'critical')`);
    await queryRunner.query(`ALTER TABLE "deals" ADD "priority" "deals_priority_enum"`);
    await queryRunner.query(`ALTER TABLE "deals" ADD "probability" integer`);
    await queryRunner.query(`ALTER TABLE "deals" ADD "currency" character varying`);
    await queryRunner.query(`ALTER TABLE "deals" ADD "referred_by_employee_id" uuid`);
    await queryRunner.query(`ALTER TABLE "deals" ADD "referred_by_company_id" uuid`);
    await queryRunner.query(`ALTER TABLE "deals" ADD "description" text`);
    await queryRunner.query(`
      ALTER TABLE "deals" ADD CONSTRAINT "FK_d95c87314737b19864bb126940b"
      FOREIGN KEY ("referred_by_company_id") REFERENCES "companies"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "deals" ADD CONSTRAINT "FK_6a802a4a903c31825dc788cf39c"
      FOREIGN KEY ("referred_by_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL
    `);
  }
}
