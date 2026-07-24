import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePriorityTaskShares1784700000013 implements MigrationInterface {
  name = "CreatePriorityTaskShares1784700000013";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // No tenant_id of its own -- scoped via task_id, which already belongs
    // to a tenant-scoped priority_tasks row. No soft-delete columns -- a
    // share is either present or hard-removed by its own "unshare" action,
    // same rationale as deal_partners_map.
    await queryRunner.query(`
      CREATE TABLE "priority_task_shares" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "task_id" uuid NOT NULL,
        "shared_with_user_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        CONSTRAINT "PK_priority_task_shares_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_priority_task_shares_task_user" UNIQUE ("task_id", "shared_with_user_id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "priority_task_shares" ADD CONSTRAINT "FK_priority_task_shares_task"
      FOREIGN KEY ("task_id") REFERENCES "priority_tasks"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "priority_task_shares" ADD CONSTRAINT "FK_priority_task_shares_shared_with_user"
      FOREIGN KEY ("shared_with_user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "priority_task_shares" ADD CONSTRAINT "FK_priority_task_shares_created_by"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    // Story 1.8's Incoming panel will query "every share row for this user"
    // across every other user's tasks -- this is that query's index.
    await queryRunner.query(`
      CREATE INDEX "IDX_priority_task_shares_shared_with_user" ON "priority_task_shares" ("shared_with_user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_priority_task_shares_shared_with_user"`);
    await queryRunner.query(`ALTER TABLE "priority_task_shares" DROP CONSTRAINT "FK_priority_task_shares_created_by"`);
    await queryRunner.query(
      `ALTER TABLE "priority_task_shares" DROP CONSTRAINT "FK_priority_task_shares_shared_with_user"`,
    );
    await queryRunner.query(`ALTER TABLE "priority_task_shares" DROP CONSTRAINT "FK_priority_task_shares_task"`);
    await queryRunner.query(`DROP TABLE "priority_task_shares"`);
  }
}
