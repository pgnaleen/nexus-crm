import { MigrationInterface, QueryRunner } from "typeorm";

// Story 1.8 (Incoming / accept / re-delegate):
//  - adds the "accepted" lifecycle value to the status enum;
//  - adds delegated_by_user_id (who performed the current pending
//    delegation), backfilled to owner_id for any task already pending
//    delegation, so existing rows show the right "delegated by" name.
export class AddPriorityTaskAcceptAndDelegatedBy1784700000014 implements MigrationInterface {
  name = "AddPriorityTaskAcceptAndDelegatedBy1784700000014";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."priority_tasks_status_enum" ADD VALUE IF NOT EXISTS 'accepted'`);

    await queryRunner.query(`ALTER TABLE "priority_tasks" ADD "delegated_by_user_id" uuid`);
    await queryRunner.query(`
      ALTER TABLE "priority_tasks" ADD CONSTRAINT "FK_priority_tasks_delegated_by"
      FOREIGN KEY ("delegated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      UPDATE "priority_tasks" SET "delegated_by_user_id" = "owner_id"
      WHERE "delegated_to_user_id" IS NOT NULL AND "delegated_by_user_id" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "priority_tasks" DROP CONSTRAINT "FK_priority_tasks_delegated_by"`);
    await queryRunner.query(`ALTER TABLE "priority_tasks" DROP COLUMN "delegated_by_user_id"`);
    // Postgres cannot drop a single enum value; leaving 'accepted' in place
    // on a down-migration is harmless (no rows reference it after the column
    // revert). A full enum rebuild is deliberately not attempted here.
  }
}
