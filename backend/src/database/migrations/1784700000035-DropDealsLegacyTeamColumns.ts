import { MigrationInterface, QueryRunner } from "typeorm";

// Retires deals.owner_id/pre_sales_person_id/pmo_id now that
// SeedDealRolesAndBackfillAssignments1784700000033 has copied everything
// backfillable into deal_role_assignments. Sales Person is no longer a
// column on deals at all -- it's the tenant's "Sales Person" deal_roles row,
// with exactly one primary assignment enforced at deal-creation time by the
// service layer (see DealsService.create()), not by a NOT NULL column.
export class DropDealsLegacyTeamColumns1784700000035 implements MigrationInterface {
  name = "DropDealsLegacyTeamColumns1784700000035";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deals" DROP CONSTRAINT "FK_deals_pre_sales_person"`);
    await queryRunner.query(`ALTER TABLE "deals" DROP CONSTRAINT "FK_deals_pmo"`);
    await queryRunner.query(`ALTER TABLE "deals" DROP CONSTRAINT "FK_39cb9fb7b130a5e5f7c5e290665"`);
    await queryRunner.query(`ALTER TABLE "deals" DROP COLUMN "pre_sales_person_id"`);
    await queryRunner.query(`ALTER TABLE "deals" DROP COLUMN "pmo_id"`);
    await queryRunner.query(`ALTER TABLE "deals" DROP COLUMN "owner_id"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Data is not restored -- deal_role_assignments remains the source of
    // truth going forward. This only restores the columns' shape so the app
    // can still boot against an older code version if ever rolled back.
    await queryRunner.query(`ALTER TABLE "deals" ADD "owner_id" uuid`);
    await queryRunner.query(`ALTER TABLE "deals" ADD "pmo_id" uuid`);
    await queryRunner.query(`ALTER TABLE "deals" ADD "pre_sales_person_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "deals" ADD CONSTRAINT "FK_39cb9fb7b130a5e5f7c5e290665" FOREIGN KEY ("owner_id") REFERENCES "employees"("id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "deals" ADD CONSTRAINT "FK_deals_pmo" FOREIGN KEY ("pmo_id") REFERENCES "employees"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "deals" ADD CONSTRAINT "FK_deals_pre_sales_person" FOREIGN KEY ("pre_sales_person_id") REFERENCES "employees"("id") ON DELETE SET NULL`,
    );
  }
}
