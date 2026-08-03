import { MigrationInterface, QueryRunner } from "typeorm";

// Feature: multi-person, extensible Deal team roles (Sales Person, Pre-Sales,
// PMO, plus admin-creatable custom roles). deal_roles is a tenant-scoped
// lookup table, same audit shape as deal_sources/departments, plus
// requires_primary_on_create (true only for the seeded Sales Person role).
// deal_role_assignments is a bare join table, same shape as
// deal_partners_map -- no tenant_id of its own (scoped transitively via
// deal_id), no soft-delete -- plus is_primary and a partial unique index
// enforcing at most one primary per (deal, role).
export class CreateDealRolesAndAssignments1784700000032 implements MigrationInterface {
  name = "CreateDealRolesAndAssignments1784700000032";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "deal_roles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "requires_primary_on_create" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "deleted_by" uuid,
        CONSTRAINT "PK_deal_roles_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "deal_roles" ADD CONSTRAINT "FK_deal_roles_tenant"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants_registry"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "deal_roles" ADD CONSTRAINT "FK_deal_roles_created_by"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "deal_roles" ADD CONSTRAINT "FK_deal_roles_updated_by"
      FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "deal_roles" ADD CONSTRAINT "FK_deal_roles_deleted_by"
      FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "deal_role_assignments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "deal_id" uuid NOT NULL,
        "role_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "is_primary" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_by" uuid,
        CONSTRAINT "PK_deal_role_assignments_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_deal_role_assignments_deal_role_user" UNIQUE ("deal_id", "role_id", "user_id")
      )
    `);
    // At most one primary assignee per role per deal -- enforced at the DB
    // level, not just in application code.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_deal_role_assignments_primary_per_role"
      ON "deal_role_assignments" ("deal_id", "role_id") WHERE "is_primary" = true
    `);
    await queryRunner.query(`
      ALTER TABLE "deal_role_assignments" ADD CONSTRAINT "FK_deal_role_assignments_deal"
      FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "deal_role_assignments" ADD CONSTRAINT "FK_deal_role_assignments_role"
      FOREIGN KEY ("role_id") REFERENCES "deal_roles"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "deal_role_assignments" ADD CONSTRAINT "FK_deal_role_assignments_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "deal_role_assignments" ADD CONSTRAINT "FK_deal_role_assignments_created_by"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_deal_role_assignments_primary_per_role"`);
    await queryRunner.query(`ALTER TABLE "deal_role_assignments" DROP CONSTRAINT "FK_deal_role_assignments_created_by"`);
    await queryRunner.query(`ALTER TABLE "deal_role_assignments" DROP CONSTRAINT "FK_deal_role_assignments_user"`);
    await queryRunner.query(`ALTER TABLE "deal_role_assignments" DROP CONSTRAINT "FK_deal_role_assignments_role"`);
    await queryRunner.query(`ALTER TABLE "deal_role_assignments" DROP CONSTRAINT "FK_deal_role_assignments_deal"`);
    await queryRunner.query(`DROP TABLE "deal_role_assignments"`);

    await queryRunner.query(`ALTER TABLE "deal_roles" DROP CONSTRAINT "FK_deal_roles_deleted_by"`);
    await queryRunner.query(`ALTER TABLE "deal_roles" DROP CONSTRAINT "FK_deal_roles_updated_by"`);
    await queryRunner.query(`ALTER TABLE "deal_roles" DROP CONSTRAINT "FK_deal_roles_created_by"`);
    await queryRunner.query(`ALTER TABLE "deal_roles" DROP CONSTRAINT "FK_deal_roles_tenant"`);
    await queryRunner.query(`DROP TABLE "deal_roles"`);
  }
}
