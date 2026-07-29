import { MigrationInterface, QueryRunner } from "typeorm";

// Epic 3, Story 3.3 -- task chat. Additive to priority_tasks' own `notes`
// field, never a replacement. Same bare-join-table shape as
// priority_task_shares: no tenant_id of its own (scoped via task_id, which
// is already tenant-scoped), no soft-delete. Unlike a share, a message is
// also immutable once sent -- no updated_at/deleted_at at all.
export class CreatePriorityTaskMessages1784700000024 implements MigrationInterface {
  name = "CreatePriorityTaskMessages1784700000024";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "priority_task_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "task_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "seq" integer NOT NULL,
        "body" text NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_by" uuid,
        CONSTRAINT "PK_priority_task_messages_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "priority_task_messages" ADD CONSTRAINT "FK_priority_task_messages_task"
      FOREIGN KEY ("task_id") REFERENCES "priority_tasks"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "priority_task_messages" ADD CONSTRAINT "FK_priority_task_messages_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "priority_task_messages" ADD CONSTRAINT "FK_priority_task_messages_created_by"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    // The detail dialog's thread query: every message for one task, in order.
    await queryRunner.query(`
      CREATE INDEX "IDX_priority_task_messages_task_seq" ON "priority_task_messages" ("task_id", "seq")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_priority_task_messages_task_seq"`);
    await queryRunner.query(`ALTER TABLE "priority_task_messages" DROP CONSTRAINT "FK_priority_task_messages_created_by"`);
    await queryRunner.query(`ALTER TABLE "priority_task_messages" DROP CONSTRAINT "FK_priority_task_messages_user"`);
    await queryRunner.query(`ALTER TABLE "priority_task_messages" DROP CONSTRAINT "FK_priority_task_messages_task"`);
    await queryRunner.query(`DROP TABLE "priority_task_messages"`);
  }
}
