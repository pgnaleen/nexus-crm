import { MigrationInterface, QueryRunner } from "typeorm";

// A constant DEFAULT on a NOT NULL ADD COLUMN backfills every existing row
// in the same statement -- same pattern as AddIsTenderToDeals, no separate
// UPDATE needed.
export class AddCurrencyToDeals1784700000021 implements MigrationInterface {
  name = "AddCurrencyToDeals1784700000021";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deals" ADD "currency" character varying(3) NOT NULL DEFAULT 'USD'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deals" DROP COLUMN "currency"`);
  }
}
