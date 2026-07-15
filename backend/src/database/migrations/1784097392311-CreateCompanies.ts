import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCompanies1784097392311 implements MigrationInterface {
    name = 'CreateCompanies1784097392311'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."companies_account_tier_enum" AS ENUM('strategic', 'enterprise', 'mid_market', 'smb')`);
        await queryRunner.query(`CREATE TYPE "public"."companies_employee_count_enum" AS ENUM('1_10', '11_50', '51_200', '201_1000', '1000_plus')`);
        await queryRunner.query(`CREATE TYPE "public"."companies_revenue_band_enum" AS ENUM('under_1m', '1m_10m', '10m_50m', '50m_250m', 'over_250m')`);
        await queryRunner.query(`CREATE TYPE "public"."companies_sector_enum" AS ENUM('public', 'private', 'government', 'non_profit')`);
        await queryRunner.query(`CREATE TYPE "public"."companies_fiscal_year_end_enum" AS ENUM('january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december')`);
        await queryRunner.query(`CREATE TYPE "public"."companies_region_enum" AS ENUM('north_america', 'europe', 'asia_pacific', 'middle_east', 'africa', 'latin_america')`);
        await queryRunner.query(`CREATE TYPE "public"."companies_credit_enum" AS ENUM('good', 'fair', 'poor', 'unknown')`);
        await queryRunner.query(`CREATE TABLE "companies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "created_by" uuid, "updated_by" uuid, "deleted_at" TIMESTAMP, "name" character varying NOT NULL, "url" character varying, "logo" character varying, "brands" jsonb, "industry_id" uuid, "sub_industry" character varying, "account_tier" "public"."companies_account_tier_enum", "employee_count" "public"."companies_employee_count_enum", "revenue_band" "public"."companies_revenue_band_enum", "annual_spend" numeric(14,2), "sector" "public"."companies_sector_enum", "stock_ticker" character varying, "fiscal_year_end" "public"."companies_fiscal_year_end_enum", "region" "public"."companies_region_enum", "country" character varying, "hq_city_address" character varying, "branches" jsonb, "parent_company_id" uuid, "credit" "public"."companies_credit_enum", CONSTRAINT "PK_d4bc3e82a314fa9e29f652c2c22" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "companies" ADD CONSTRAINT "FK_1afe500bd3d442583371738b22c" FOREIGN KEY ("tenant_id") REFERENCES "tenants_registry"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "companies" ADD CONSTRAINT "FK_a9ea9f740765b888dbb4055bc9a" FOREIGN KEY ("industry_id") REFERENCES "industries"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "companies" ADD CONSTRAINT "FK_0bf6cd4fc9efe17c5ea04061576" FOREIGN KEY ("parent_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "companies" DROP CONSTRAINT "FK_0bf6cd4fc9efe17c5ea04061576"`);
        await queryRunner.query(`ALTER TABLE "companies" DROP CONSTRAINT "FK_a9ea9f740765b888dbb4055bc9a"`);
        await queryRunner.query(`ALTER TABLE "companies" DROP CONSTRAINT "FK_1afe500bd3d442583371738b22c"`);
        await queryRunner.query(`DROP TABLE "companies"`);
        await queryRunner.query(`DROP TYPE "public"."companies_credit_enum"`);
        await queryRunner.query(`DROP TYPE "public"."companies_region_enum"`);
        await queryRunner.query(`DROP TYPE "public"."companies_fiscal_year_end_enum"`);
        await queryRunner.query(`DROP TYPE "public"."companies_sector_enum"`);
        await queryRunner.query(`DROP TYPE "public"."companies_revenue_band_enum"`);
        await queryRunner.query(`DROP TYPE "public"."companies_employee_count_enum"`);
        await queryRunner.query(`DROP TYPE "public"."companies_account_tier_enum"`);
    }

}
