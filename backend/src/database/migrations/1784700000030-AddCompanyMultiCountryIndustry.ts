import { MigrationInterface, QueryRunner } from "typeorm";

// A company can operate in several countries and span several industries.
// Both were single-valued: companies.country (varchar) and companies.industry_id
// (FK -> industries). This replaces them rather than adding "additional_*"
// siblings -- two sources of truth for the same fact drift, and every query
// then has to remember to read both.
//
// Countries become a jsonb array on the row itself (no countries table exists;
// values are plain ISO names from the frontend COUNTRIES list), matching the
// brands/branches columns already on this same table. Industries become a real
// join table, because `industries` IS a table and referential integrity has to
// survive -- a jsonb array of uuids would not enforce that an industry exists.
//
// Order matters: add + backfill + verify, THEN drop. A single transaction, so a
// failed backfill cannot leave the old columns dropped and the new ones empty.
export class AddCompanyMultiCountryIndustry1784700000030 implements MigrationInterface {
  name = "AddCompanyMultiCountryIndustry1784700000030";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "companies" ADD "countries" jsonb`);

    await queryRunner.query(`
      CREATE TABLE "company_industries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "industry_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        CONSTRAINT "PK_company_industries" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_company_industries_company_industry" UNIQUE ("company_id", "industry_id"),
        CONSTRAINT "FK_company_industries_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_company_industries_industry" FOREIGN KEY ("industry_id")
          REFERENCES "industries"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_company_industries_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    // The join table is queried by company on every company read.
    await queryRunner.query(
      `CREATE INDEX "IDX_company_industries_company" ON "company_industries" ("company_id")`,
    );

    // Backfill. Empty-string countries exist in the data (the form submitted
    // "" before it learned to send undefined), and must not become [""] --
    // findDistinctCountries already filters them out downstream and a one-empty
    // -string array would read as "has a country" everywhere else.
    await queryRunner.query(`
      UPDATE "companies"
      SET "countries" = jsonb_build_array("country")
      WHERE "country" IS NOT NULL AND btrim("country") <> ''
    `);

    // created_by is deliberately carried over from the company's own creator
    // rather than left NULL: these links are not new facts, they are the same
    // fact restated, and attributing them to whoever created the company is
    // the only honest actor available at migration time.
    await queryRunner.query(`
      INSERT INTO "company_industries" ("company_id", "industry_id", "created_by")
      SELECT "id", "industry_id", "created_by"
      FROM "companies"
      WHERE "industry_id" IS NOT NULL
    `);

    // Fail loudly rather than silently dropping data: if any row that had a
    // value did not make it across, abort the whole transaction.
    const [{ missing }] = await queryRunner.query(`
      SELECT COUNT(*)::int AS missing FROM "companies"
      WHERE ("country" IS NOT NULL AND btrim("country") <> '' AND "countries" IS NULL)
         OR ("industry_id" IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM "company_industries" ci WHERE ci."company_id" = "companies"."id"))
    `);
    if (missing > 0) {
      throw new Error(`Backfill incomplete: ${missing} companies did not migrate. Aborting.`);
    }

    await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "country"`);
    await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "industry_id"`);
  }

  // LOSSY BY NATURE. The old columns hold one value each; the new ones hold
  // many. Reverting keeps the first country and the oldest industry link and
  // discards the rest -- there is nowhere for them to go. Reverting after any
  // real multi-value data has been entered WILL lose it.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "companies" ADD "country" character varying`);
    await queryRunner.query(`ALTER TABLE "companies" ADD "industry_id" uuid`);
    await queryRunner.query(`
      ALTER TABLE "companies" ADD CONSTRAINT "FK_companies_industry"
      FOREIGN KEY ("industry_id") REFERENCES "industries"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      UPDATE "companies"
      SET "country" = "countries"->>0
      WHERE "countries" IS NOT NULL AND jsonb_array_length("countries") > 0
    `);
    await queryRunner.query(`
      UPDATE "companies" c
      SET "industry_id" = sub."industry_id"
      FROM (
        SELECT DISTINCT ON ("company_id") "company_id", "industry_id"
        FROM "company_industries"
        ORDER BY "company_id", "created_at" ASC
      ) sub
      WHERE c."id" = sub."company_id"
    `);

    await queryRunner.query(`DROP TABLE "company_industries"`);
    await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "countries"`);
  }
}
