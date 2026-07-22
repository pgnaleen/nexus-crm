import { MigrationInterface, QueryRunner } from "typeorm";

// deals.service.ts::create() computes dealCode from countAllScoped()+1 with
// no lock -- two concurrent POST /deals in the same tenant can otherwise
// silently produce identical codes. This constraint doesn't prevent the
// race by itself, but combined with the retry-on-conflict added to
// create() it turns a silent duplicate into a guaranteed-unique code.
export class AddUniqueDealCodePerTenant1784700000004 implements MigrationInterface {
  name = "AddUniqueDealCodePerTenant1784700000004";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_deals_tenant_deal_code" ON "deals" ("tenant_id", "deal_code")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_deals_tenant_deal_code"`);
  }
}
