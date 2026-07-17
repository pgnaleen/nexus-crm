import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDepartmentIsActive1784272927904 implements MigrationInterface {
    name = 'AddDepartmentIsActive1784272927904'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "departments" ADD "is_active" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "departments" DROP COLUMN "is_active"`);
    }

}
