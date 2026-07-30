import { MigrationInterface, QueryRunner } from "typeorm";

// Adds edit/delete to task chat. Plain nullable columns, deliberately NOT a
// TypeORM @DeleteDateColumn: that decorator makes every plain repo.find()
// silently add "deleted_at IS NULL", which would make findAll() stop
// returning deleted messages entirely -- breaking the "show a tombstone in
// place, don't vanish" requirement. The body column itself is never
// overwritten by a delete; only the API response layer masks it (see
// priority-task-messages.controller.ts's toResponse), matching this
// project's soft-delete-everywhere philosophy of never destroying data.
export class AddPriorityTaskMessageEditDelete1784700000025 implements MigrationInterface {
  name = "AddPriorityTaskMessageEditDelete1784700000025";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "priority_task_messages"
        ADD "updated_at" TIMESTAMP WITH TIME ZONE,
        ADD "deleted_at" TIMESTAMP WITH TIME ZONE,
        ADD "deleted_by" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "priority_task_messages" ADD CONSTRAINT "FK_priority_task_messages_deleted_by"
      FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "priority_task_messages" DROP CONSTRAINT "FK_priority_task_messages_deleted_by"`);
    await queryRunner.query(`
      ALTER TABLE "priority_task_messages"
        DROP COLUMN "updated_at",
        DROP COLUMN "deleted_at",
        DROP COLUMN "deleted_by"
    `);
  }
}
