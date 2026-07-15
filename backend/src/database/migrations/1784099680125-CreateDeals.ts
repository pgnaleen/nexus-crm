import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDeals1784099680125 implements MigrationInterface {
    name = 'CreateDeals1784099680125'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."deals_deal_type_enum" AS ENUM('new_business', 'renewal', 'upsell', 'cross_sell')`);
        await queryRunner.query(`CREATE TYPE "public"."deals_status_enum" AS ENUM('open', 'won', 'lost', 'on_hold')`);
        await queryRunner.query(`CREATE TYPE "public"."deals_priority_enum" AS ENUM('low', 'medium', 'high', 'critical')`);
        await queryRunner.query(`CREATE TABLE "deals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "created_by" uuid, "updated_by" uuid, "deleted_at" TIMESTAMP, "deal_code" character varying NOT NULL, "name" character varying NOT NULL, "deal_type" "public"."deals_deal_type_enum" NOT NULL, "description" text, "company_id" uuid NOT NULL, "primary_contact_id" uuid, "contact_id" uuid, "source_id" uuid, "referred_by_company_id" uuid, "referred_by_employee_id" uuid, "owner_id" uuid NOT NULL, "main_stage_id" uuid, "current_stage_id" uuid NOT NULL, "status" "public"."deals_status_enum" NOT NULL DEFAULT 'open', "estimated_value" numeric(14,2), "currency" character varying, "expected_close_date" date, "probability" integer, "priority" "public"."deals_priority_enum", "department_id" uuid, CONSTRAINT "PK_8c66f03b250f613ff8615940b4b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "deals" ADD CONSTRAINT "FK_d40aeaababdbc39be4820cd1f55" FOREIGN KEY ("tenant_id") REFERENCES "tenants_registry"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deals" ADD CONSTRAINT "FK_eb4869da6d8f7121b269140994d" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deals" ADD CONSTRAINT "FK_e061749ffbffb8d012ca3df9f3f" FOREIGN KEY ("primary_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deals" ADD CONSTRAINT "FK_76e504b6bb116e6cdc2ee6a0cb5" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deals" ADD CONSTRAINT "FK_fb126796015483e0ba2bf4ca6be" FOREIGN KEY ("source_id") REFERENCES "deal_sources"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deals" ADD CONSTRAINT "FK_d95c87314737b19864bb126940b" FOREIGN KEY ("referred_by_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deals" ADD CONSTRAINT "FK_6a802a4a903c31825dc788cf39c" FOREIGN KEY ("referred_by_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deals" ADD CONSTRAINT "FK_39cb9fb7b130a5e5f7c5e290665" FOREIGN KEY ("owner_id") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deals" ADD CONSTRAINT "FK_99823c8635a9b506a94db09cb40" FOREIGN KEY ("main_stage_id") REFERENCES "main_stages"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deals" ADD CONSTRAINT "FK_1bd9ea91a3aeaeed8ebb75b9d67" FOREIGN KEY ("current_stage_id") REFERENCES "sub_stages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deals" ADD CONSTRAINT "FK_2f88f3c736e8a52c4adc1040af3" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "deals" DROP CONSTRAINT "FK_2f88f3c736e8a52c4adc1040af3"`);
        await queryRunner.query(`ALTER TABLE "deals" DROP CONSTRAINT "FK_1bd9ea91a3aeaeed8ebb75b9d67"`);
        await queryRunner.query(`ALTER TABLE "deals" DROP CONSTRAINT "FK_99823c8635a9b506a94db09cb40"`);
        await queryRunner.query(`ALTER TABLE "deals" DROP CONSTRAINT "FK_39cb9fb7b130a5e5f7c5e290665"`);
        await queryRunner.query(`ALTER TABLE "deals" DROP CONSTRAINT "FK_6a802a4a903c31825dc788cf39c"`);
        await queryRunner.query(`ALTER TABLE "deals" DROP CONSTRAINT "FK_d95c87314737b19864bb126940b"`);
        await queryRunner.query(`ALTER TABLE "deals" DROP CONSTRAINT "FK_fb126796015483e0ba2bf4ca6be"`);
        await queryRunner.query(`ALTER TABLE "deals" DROP CONSTRAINT "FK_76e504b6bb116e6cdc2ee6a0cb5"`);
        await queryRunner.query(`ALTER TABLE "deals" DROP CONSTRAINT "FK_e061749ffbffb8d012ca3df9f3f"`);
        await queryRunner.query(`ALTER TABLE "deals" DROP CONSTRAINT "FK_eb4869da6d8f7121b269140994d"`);
        await queryRunner.query(`ALTER TABLE "deals" DROP CONSTRAINT "FK_d40aeaababdbc39be4820cd1f55"`);
        await queryRunner.query(`DROP TABLE "deals"`);
        await queryRunner.query(`DROP TYPE "public"."deals_priority_enum"`);
        await queryRunner.query(`DROP TYPE "public"."deals_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."deals_deal_type_enum"`);
    }

}
