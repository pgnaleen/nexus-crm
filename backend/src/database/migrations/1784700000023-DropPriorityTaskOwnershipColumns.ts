import { MigrationInterface, QueryRunner } from "typeorm";

// Epic 3, Story 3.2. Runs only after the service layer has been cut over to
// read/write priority_task_flow exclusively and that cutover has been
// verified live (per CLAUDE.md's rule: query the actual rows, don't
// assume) -- see this story's writeup in epics-task-management.md for the
// verification evidence. Drops priority_tasks' now-dead ownership/placement
// columns and the whole priority_task_delegation_trackers table, both fully
// superseded by Story 3.1's priority_task_flow.
//
// down() restores the schema shape (columns + table + enum) but NOT the
// data that used to live in it -- by the time this migration is reverted,
// priority_task_flow is the only place that data still exists, and walking
// it back into the old mutable-column shape would just reintroduce the very
// bug this epic exists to remove. Re-adding owner_id nullable (not NOT NULL,
// as it originally was) reflects that honestly rather than pretending a
// full reverse-backfill happened.
export class DropPriorityTaskOwnershipColumns1784700000023 implements MigrationInterface {
  name = "DropPriorityTaskOwnershipColumns1784700000023";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_priority_tasks_tenant_owner"`);
    await queryRunner.query(`ALTER TABLE "priority_tasks" DROP CONSTRAINT "CHK_priority_tasks_progress_range"`);
    await queryRunner.query(`ALTER TABLE "priority_tasks" DROP CONSTRAINT "FK_priority_tasks_owner"`);
    await queryRunner.query(`ALTER TABLE "priority_tasks" DROP CONSTRAINT "FK_priority_tasks_delegated_to_user"`);
    await queryRunner.query(`ALTER TABLE "priority_tasks" DROP CONSTRAINT "FK_priority_tasks_delegated_by"`);

    await queryRunner.query(`
      ALTER TABLE "priority_tasks"
        DROP COLUMN "owner_id",
        DROP COLUMN "quadrant",
        DROP COLUMN "rank",
        DROP COLUMN "status",
        DROP COLUMN "progress",
        DROP COLUMN "delegated_to_user_id",
        DROP COLUMN "delegated_by_user_id"
    `);

    await queryRunner.query(`DROP TABLE "priority_task_delegation_trackers"`);
    await queryRunner.query(`DROP TYPE "public"."priority_tasks_status_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."priority_tasks_status_enum" AS ENUM('placed', 'delegated', 'accepted', 'completed', 'archived')`,
    );

    await queryRunner.query(`
      ALTER TABLE "priority_tasks"
        ADD "owner_id" uuid,
        ADD "quadrant" "public"."priority_tasks_quadrant_enum",
        ADD "rank" integer,
        ADD "status" "public"."priority_tasks_status_enum",
        ADD "progress" integer NOT NULL DEFAULT 0,
        ADD "delegated_to_user_id" uuid,
        ADD "delegated_by_user_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "priority_tasks" ADD CONSTRAINT "CHK_priority_tasks_progress_range"
      CHECK ("progress" >= 0 AND "progress" <= 100)
    `);
    await queryRunner.query(`
      ALTER TABLE "priority_tasks" ADD CONSTRAINT "FK_priority_tasks_owner"
      FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "priority_tasks" ADD CONSTRAINT "FK_priority_tasks_delegated_to_user"
      FOREIGN KEY ("delegated_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "priority_tasks" ADD CONSTRAINT "FK_priority_tasks_delegated_by"
      FOREIGN KEY ("delegated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_priority_tasks_tenant_owner" ON "priority_tasks" ("tenant_id", "owner_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "priority_task_delegation_trackers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "task_id" uuid NOT NULL,
        "delegator_id" uuid NOT NULL,
        "quadrant" "public"."priority_tasks_quadrant_enum" NOT NULL DEFAULT 'delegate',
        "rank" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        CONSTRAINT "PK_priority_task_delegation_trackers_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_priority_task_delegation_trackers_task_delegator" UNIQUE ("task_id", "delegator_id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "priority_task_delegation_trackers" ADD CONSTRAINT "FK_priority_task_delegation_trackers_task"
      FOREIGN KEY ("task_id") REFERENCES "priority_tasks"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "priority_task_delegation_trackers" ADD CONSTRAINT "FK_priority_task_delegation_trackers_delegator"
      FOREIGN KEY ("delegator_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "priority_task_delegation_trackers" ADD CONSTRAINT "FK_priority_task_delegation_trackers_created_by"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_priority_task_delegation_trackers_delegator" ON "priority_task_delegation_trackers" ("delegator_id")
    `);
  }
}
