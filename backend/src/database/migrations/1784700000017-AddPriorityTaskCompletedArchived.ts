import { MigrationInterface, QueryRunner } from "typeorm";

// Stories 1.9/1.10 -- the "completed" (owner marked done) and "archived"
// (off the active board, restorable) lifecycle values.
export class AddPriorityTaskCompletedArchived1784700000017 implements MigrationInterface {
  name = "AddPriorityTaskCompletedArchived1784700000017";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."priority_tasks_status_enum" ADD VALUE IF NOT EXISTS 'completed'`);
    await queryRunner.query(`ALTER TYPE "public"."priority_tasks_status_enum" ADD VALUE IF NOT EXISTS 'archived'`);
  }

  public async down(): Promise<void> {
    // Postgres cannot drop a single enum value; leaving these in place is
    // harmless once no rows reference them.
  }
}
