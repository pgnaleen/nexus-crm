import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsTenderToDeals1784700000005 implements MigrationInterface {
    name = 'AddIsTenderToDeals1784700000005'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "deals" ADD "is_tender" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "deals" DROP COLUMN "is_tender"`);
    }

}
