import { MigrationInterface, QueryRunner } from "typeorm";

// Platform-level (no tenant_id) -- market exchange rates aren't tenant data,
// one shared row set read by every tenant. units_per_usd matches the shape
// exchangerate-api.com's own /latest/USD response already returns (how many
// units of this currency equal 1 USD), so writes need no reshaping.
// Standard uuid PK (not currency_code itself) to extend AuditedEntity per
// CLAUDE.md's "every table extends the audited base" rule; currency_code is
// a separate unique column instead. Plain (not partial) unique index --
// unlike relationship_company_contact_map, a rate row is never soft-deleted
// through the app (only ever upserted by currency_code), so there's no
// re-tag-after-soft-delete scenario to guard against; a plain index lets the
// refresh job use a standard ON CONFLICT (currency_code) DO UPDATE.
export class CreateFxRates1784700000036 implements MigrationInterface {
  name = "CreateFxRates1784700000036";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "fx_rates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "currency_code" character varying(3) NOT NULL,
        "units_per_usd" numeric(18,6) NOT NULL,
        "fetched_at" TIMESTAMPTZ NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "deleted_at" TIMESTAMPTZ,
        "deleted_by" uuid,
        CONSTRAINT "PK_fx_rates_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_fx_rates_currency_code" ON "fx_rates" ("currency_code")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "fx_rates"`);
  }
}
