import { MigrationInterface, QueryRunner } from "typeorm";

export class AllowMultipleRelationshipTypesPerSystemRole1784700000020 implements MigrationInterface {
  name = "AllowMultipleRelationshipTypesPerSystemRole1784700000020";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_relationship_types_tenant_system_role"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_relationship_types_tenant_system_role"
      ON "relationship_types" ("tenant_id", "system_role")
      WHERE "system_role" IS NOT NULL AND "deleted_at" IS NULL
    `);
  }
}
