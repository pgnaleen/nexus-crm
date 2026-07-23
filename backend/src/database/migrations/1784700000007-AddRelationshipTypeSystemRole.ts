import { MigrationInterface, QueryRunner } from "typeorm";

// Lets a tenant flag one relationship_types row as its "Customer" type and
// another as its "Partner" type -- Deal's Customer/Partners pickers resolve
// this flag (by id, never by name) to filter to only tagged companies/contacts.
// The partial index's "deleted_at IS NULL" clause is required: without it, a
// soft-deleted flagged row would permanently occupy that (tenant, role) slot.
export class AddRelationshipTypeSystemRole1784700000007 implements MigrationInterface {
  name = "AddRelationshipTypeSystemRole1784700000007";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."relationship_types_system_role_enum" AS ENUM('customer', 'partner')
    `);
    await queryRunner.query(`
      ALTER TABLE "relationship_types" ADD "system_role" "public"."relationship_types_system_role_enum"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_relationship_types_tenant_system_role"
      ON "relationship_types" ("tenant_id", "system_role")
      WHERE "system_role" IS NOT NULL AND "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_relationship_types_tenant_system_role"`);
    await queryRunner.query(`ALTER TABLE "relationship_types" DROP COLUMN "system_role"`);
    await queryRunner.query(`DROP TYPE "public"."relationship_types_system_role_enum"`);
  }
}
