import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePriorityTasks1784700000009 implements MigrationInterface {
  name = "CreatePriorityTasks1784700000009";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."priority_tasks_quadrant_enum" AS ENUM('do', 'decide', 'delegate', 'delete')`,
    );
    await queryRunner.query(`CREATE TYPE "public"."priority_tasks_status_enum" AS ENUM('placed')`);

    // Story 1.1/1.2 only -- no shared/delegated columns yet (see the epic's
    // "Open Questions for Architecture" note on per-perspective placement,
    // which needs a real decision before Story 1.6). ownerId is the one
    // domain-specific actor column; createdBy (from AuditedTenantEntity)
    // doubles as "who originally created it" for the owned/received badge,
    // so there's no separate creator_id column.
    await queryRunner.query(`
      CREATE TABLE "priority_tasks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "deleted_at" TIMESTAMP,
        "deleted_by" uuid,
        "owner_id" uuid NOT NULL,
        "title" character varying NOT NULL,
        "notes" text,
        "quadrant" "public"."priority_tasks_quadrant_enum" NOT NULL,
        "rank" integer NOT NULL,
        "status" "public"."priority_tasks_status_enum" NOT NULL DEFAULT 'placed',
        "progress" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_priority_tasks_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_priority_tasks_progress_range" CHECK ("progress" >= 0 AND "progress" <= 100)
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "priority_tasks" ADD CONSTRAINT "FK_priority_tasks_tenant"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants_registry"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "priority_tasks" ADD CONSTRAINT "FK_priority_tasks_owner"
      FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "priority_tasks" ADD CONSTRAINT "FK_priority_tasks_created_by"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "priority_tasks" ADD CONSTRAINT "FK_priority_tasks_updated_by"
      FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "priority_tasks" ADD CONSTRAINT "FK_priority_tasks_deleted_by"
      FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    // Every real query filters by tenant + the signed-in user's own board.
    await queryRunner.query(`
      CREATE INDEX "IDX_priority_tasks_tenant_owner" ON "priority_tasks" ("tenant_id", "owner_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_priority_tasks_tenant_owner"`);
    await queryRunner.query(`ALTER TABLE "priority_tasks" DROP CONSTRAINT "FK_priority_tasks_deleted_by"`);
    await queryRunner.query(`ALTER TABLE "priority_tasks" DROP CONSTRAINT "FK_priority_tasks_updated_by"`);
    await queryRunner.query(`ALTER TABLE "priority_tasks" DROP CONSTRAINT "FK_priority_tasks_created_by"`);
    await queryRunner.query(`ALTER TABLE "priority_tasks" DROP CONSTRAINT "FK_priority_tasks_owner"`);
    await queryRunner.query(`ALTER TABLE "priority_tasks" DROP CONSTRAINT "FK_priority_tasks_tenant"`);
    await queryRunner.query(`DROP TABLE "priority_tasks"`);
    await queryRunner.query(`DROP TYPE "public"."priority_tasks_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."priority_tasks_quadrant_enum"`);
  }
}
