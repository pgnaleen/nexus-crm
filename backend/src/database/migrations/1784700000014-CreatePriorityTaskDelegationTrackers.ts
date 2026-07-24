import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePriorityTaskDelegationTrackers1784700000014 implements MigrationInterface {
  name = "CreatePriorityTaskDelegationTrackers1784700000014";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Safe inside this migration's own transaction on Postgres 12+ as long
    // as the new value isn't also used later in this same transaction --
    // it isn't (nothing here INSERTs/UPDATEs a row using 'delegated').
    await queryRunner.query(`ALTER TYPE "public"."priority_tasks_status_enum" ADD VALUE 'delegated'`);

    // Pending-delegation pointer: set the moment a task is delegated
    // (Story 1.6), cleared back to NULL once Story 1.8's accept flow
    // transfers ownerId to the recipient. ON DELETE SET NULL, not CASCADE
    // -- the task itself must survive the delegate target's account being
    // removed, same reasoning as created_by/updated_by/deleted_by.
    await queryRunner.query(`ALTER TABLE "priority_tasks" ADD "delegated_to_user_id" uuid`);
    await queryRunner.query(`
      ALTER TABLE "priority_tasks" ADD CONSTRAINT "FK_priority_tasks_delegated_to_user"
      FOREIGN KEY ("delegated_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    // The delegator's own tracking card -- lives in their DELEGATE quadrant,
    // referencing the real task by id, never a duplicate of its content.
    // Same bare-join-table shape as priority_task_shares: no tenant_id of
    // its own (scoped via delegator_id, always the caller's own id, or via
    // task_id which is already tenant-scoped), no soft-delete.
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_priority_task_delegation_trackers_delegator"`);
    await queryRunner.query(
      `ALTER TABLE "priority_task_delegation_trackers" DROP CONSTRAINT "FK_priority_task_delegation_trackers_created_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "priority_task_delegation_trackers" DROP CONSTRAINT "FK_priority_task_delegation_trackers_delegator"`,
    );
    await queryRunner.query(
      `ALTER TABLE "priority_task_delegation_trackers" DROP CONSTRAINT "FK_priority_task_delegation_trackers_task"`,
    );
    await queryRunner.query(`DROP TABLE "priority_task_delegation_trackers"`);

    await queryRunner.query(`ALTER TABLE "priority_tasks" DROP CONSTRAINT "FK_priority_tasks_delegated_to_user"`);
    await queryRunner.query(`ALTER TABLE "priority_tasks" DROP COLUMN "delegated_to_user_id"`);

    // Postgres has no DROP VALUE for enums -- rebuild the type without it.
    await queryRunner.query(
      `ALTER TABLE "priority_tasks" ALTER COLUMN "status" TYPE character varying USING "status"::character varying`,
    );
    await queryRunner.query(`DROP TYPE "public"."priority_tasks_status_enum"`);
    await queryRunner.query(`CREATE TYPE "public"."priority_tasks_status_enum" AS ENUM('placed')`);
    await queryRunner.query(`
      ALTER TABLE "priority_tasks" ALTER COLUMN "status" TYPE "public"."priority_tasks_status_enum"
      USING "status"::"public"."priority_tasks_status_enum"
    `);
    await queryRunner.query(`ALTER TABLE "priority_tasks" ALTER COLUMN "status" SET DEFAULT 'placed'`);
  }
}
