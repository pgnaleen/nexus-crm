import { MigrationInterface, QueryRunner } from "typeorm";

// The `users` table declares its own audit columns by hand (see the comment
// on User entity) rather than extending AuditedTenantEntity, since that base
// class's own createdBy/updatedBy relations import User -- User extending it
// too would be a circular "class extends" that crashes at runtime. It was
// therefore missed by the main AddDeletedByColumn migration, which only
// covered tables that actually extend the shared base classes. This is a
// self-referential FK (users.deleted_by -> users.id), same pattern as its
// existing created_by/updated_by columns.
export class AddDeletedByToUsers1784700000001 implements MigrationInterface {
  name = "AddDeletedByToUsers1784700000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "deleted_by" uuid`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_users_deleted_by" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_deleted_by"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deleted_by"`);
  }
}
