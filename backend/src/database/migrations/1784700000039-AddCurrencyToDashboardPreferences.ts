import { MigrationInterface, QueryRunner } from "typeorm";

// Nullable -- null means "no preference saved yet", both the service and the
// frontend fall back to "USD" in that case. See the entity's own comment.
export class AddCurrencyToDashboardPreferences1784700000039 implements MigrationInterface {
  name = "AddCurrencyToDashboardPreferences1784700000039";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "dashboard_preferences" ADD COLUMN "currency" varchar(3)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "dashboard_preferences" DROP COLUMN "currency"`);
  }
}
