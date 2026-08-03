import { MigrationInterface, QueryRunner } from "typeorm";

// Powers the Sales Pipeline Dashboard's "Weighted Pipeline" KPI (sum of each
// deal's value * its stage's weight%). Nullable and NOT defaulted to 0 --
// an admin who hasn't configured a stage's weight yet is a distinct state
// from one explicitly weighted at 0% (a legitimate value, e.g. for a
// "Lost"-flavoured stage someone still wants counted in the funnel
// breakdown but not in the weighted total). The dashboard aggregation must
// be able to tell "unconfigured" apart from "explicitly zero".
export class AddWeightPercentToMainStages1784700000034 implements MigrationInterface {
  name = "AddWeightPercentToMainStages1784700000034";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "main_stages" ADD "weight_percent" numeric(5,2)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "main_stages" DROP COLUMN "weight_percent"`);
  }
}
