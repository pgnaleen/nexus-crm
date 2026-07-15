import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameStageHistoryTables1784101966684 implements MigrationInterface {
    name = 'RenameStageHistoryTables1784101966684'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "deal_main_stage_history" RENAME TO "main_stage_history"`);
        await queryRunner.query(`ALTER TABLE "deal_sub_stage_history" RENAME TO "sub_stage_history"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "main_stage_history" RENAME TO "deal_main_stage_history"`);
        await queryRunner.query(`ALTER TABLE "sub_stage_history" RENAME TO "deal_sub_stage_history"`);
    }

}
