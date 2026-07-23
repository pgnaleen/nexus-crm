import { MigrationInterface, QueryRunner } from "typeorm";

// Story 1.6 (Grant Login Access) -- one User account may be linked to at
// most one Employee. The app layer already refuses double-links
// (EmployeesService.linkToUser), but a partial unique index makes the
// invariant real at the DB level too. Partial on deleted_at IS NULL so a
// soft-deleted employee row never blocks its old user id from being linked
// to a fresh record.
export class AddEmployeesUserIdUniqueIndex1784700000010 implements MigrationInterface {
  name = "AddEmployeesUserIdUniqueIndex1784700000010";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_employees_user_id" ON "employees" ("user_id") WHERE "user_id" IS NOT NULL AND "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_employees_user_id"`);
  }
}
