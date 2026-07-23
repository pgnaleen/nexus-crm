import { MigrationInterface, QueryRunner } from "typeorm";

// Story 1.8 (Org Chart editor) -- distinguishes "placed directly beneath
// the Company root" (placed_at_root = true, reporting_manager_id NULL) from
// "not placed in the structure at all" (both false/NULL -> unplaced panel).
export class AddEmployeesPlacedAtRoot1784700000011 implements MigrationInterface {
  name = "AddEmployeesPlacedAtRoot1784700000011";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "employees" ADD "placed_at_root" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "placed_at_root"`);
  }
}
