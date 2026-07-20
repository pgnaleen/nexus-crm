import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCompanyParentCompanyName1784519619289 implements MigrationInterface {
    name = 'AddCompanyParentCompanyName1784519619289'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "companies" ADD "parent_company_name" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "parent_company_name"`);
    }

}
