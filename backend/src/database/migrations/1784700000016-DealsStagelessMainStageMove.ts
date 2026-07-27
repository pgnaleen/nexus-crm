import { MigrationInterface, QueryRunner } from "typeorm";

// Flips the Deal stage invariant: mainStageId becomes the required "where
// this deal lives" column, currentStageId (Sub Stage) becomes optional --
// set only once a deal is actually placed into a real Sub Stage. Lets a
// tenant add Main Stages and move deals directly between them without ever
// configuring Sub Stages. See plan-deals-stageless-main-stage-move.md.
export class DealsStagelessMainStageMove1784700000016 implements MigrationInterface {
  name = "DealsStagelessMainStageMove1784700000016";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Defensive backfill -- every existing deal already has a real Sub Stage
    // today, so main_stage_id should already be populated via that Sub
    // Stage's own main_stage_id, but this guards against any stray null.
    await queryRunner.query(`
      UPDATE "deals"
      SET "main_stage_id" = "sub_stages"."main_stage_id"
      FROM "sub_stages"
      WHERE "deals"."current_stage_id" = "sub_stages"."id"
        AND "deals"."main_stage_id" IS NULL
    `);

    await queryRunner.query(`ALTER TABLE "deals" ALTER COLUMN "main_stage_id" SET NOT NULL`);

    // Deleting a Main Stage that still has deals sitting directly in it (no
    // Sub Stage) must now be blocked, not silently null this out -- same
    // "must reassign before delete" treatment as owner_id/current_stage_id.
    await queryRunner.query(`ALTER TABLE "deals" DROP CONSTRAINT "FK_99823c8635a9b506a94db09cb40"`);
    await queryRunner.query(`
      ALTER TABLE "deals" ADD CONSTRAINT "FK_99823c8635a9b506a94db09cb40"
      FOREIGN KEY ("main_stage_id") REFERENCES "main_stages"("id") ON DELETE NO ACTION
    `);

    await queryRunner.query(`ALTER TABLE "deals" ALTER COLUMN "current_stage_id" DROP NOT NULL`);

    await queryRunner.query(`ALTER TABLE "main_stages" ADD "is_won" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "main_stages" ADD "is_lost" boolean NOT NULL DEFAULT false`);

    // Nullable so a move that leaves a deal with no Sub Stage still gets a
    // history row; ON DELETE SET NULL to match from_stage_id's existing
    // treatment on this same table.
    await queryRunner.query(`ALTER TABLE "sub_stage_history" ALTER COLUMN "to_stage_id" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "sub_stage_history" DROP CONSTRAINT "FK_47b4b00c7d683ea61965f476ed2"`);
    await queryRunner.query(`
      ALTER TABLE "sub_stage_history" ADD CONSTRAINT "FK_47b4b00c7d683ea61965f476ed2"
      FOREIGN KEY ("to_stage_id") REFERENCES "sub_stages"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sub_stage_history" DROP CONSTRAINT "FK_47b4b00c7d683ea61965f476ed2"`);
    await queryRunner.query(`
      ALTER TABLE "sub_stage_history" ADD CONSTRAINT "FK_47b4b00c7d683ea61965f476ed2"
      FOREIGN KEY ("to_stage_id") REFERENCES "sub_stages"("id")
    `);
    await queryRunner.query(`ALTER TABLE "sub_stage_history" ALTER COLUMN "to_stage_id" SET NOT NULL`);

    await queryRunner.query(`ALTER TABLE "main_stages" DROP COLUMN "is_lost"`);
    await queryRunner.query(`ALTER TABLE "main_stages" DROP COLUMN "is_won"`);

    await queryRunner.query(`ALTER TABLE "deals" ALTER COLUMN "current_stage_id" SET NOT NULL`);

    await queryRunner.query(`ALTER TABLE "deals" DROP CONSTRAINT "FK_99823c8635a9b506a94db09cb40"`);
    await queryRunner.query(`
      ALTER TABLE "deals" ADD CONSTRAINT "FK_99823c8635a9b506a94db09cb40"
      FOREIGN KEY ("main_stage_id") REFERENCES "main_stages"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`ALTER TABLE "deals" ALTER COLUMN "main_stage_id" DROP NOT NULL`);
  }
}
