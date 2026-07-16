import { MigrationInterface, QueryRunner } from "typeorm";

export class ConvertDealSourceCategoryToEnum1784214181322 implements MigrationInterface {
    name = 'ConvertDealSourceCategoryToEnum1784214181322'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "deal_sources" DROP COLUMN "category"`);
        await queryRunner.query(`CREATE TYPE "public"."deal_sources_category_enum" AS ENUM('referral', 'direct_sales', 'marketing', 'partner', 'event', 'existing_customer', 'marketplace', 'tender_rfp', 'strategic_relationship', 'other')`);
        await queryRunner.query(`ALTER TABLE "deal_sources" ADD "category" "public"."deal_sources_category_enum"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "deal_sources" DROP COLUMN "category"`);
        await queryRunner.query(`DROP TYPE "public"."deal_sources_category_enum"`);
        await queryRunner.query(`ALTER TABLE "deal_sources" ADD "category" character varying`);
    }

}
