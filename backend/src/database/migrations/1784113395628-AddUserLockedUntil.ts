import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserLockedUntil1784113395628 implements MigrationInterface {
    name = 'AddUserLockedUntil1784113395628'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "locked_until" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "locked_until"`);
    }

}
